/**
 * SMS-012 — durable notification dispatch worker (payments-sweeper pattern).
 *
 * The DB ledger IS the queue: compose writes QUEUED NotificationDelivery rows,
 * this worker claims due ones (nextAttemptAt <= now), hands them to the channel
 * adapter and records the outcome. Ratified cadence: 60s sweep, immediate kick
 * after every compose, 5 attempts, backoff 1m -> 5m -> 15m -> 1h (4h cap). An
 * unconfigured channel fails fast and permanently with error 'channel-disabled'
 * (the ledger must tell the truth instead of retrying into a vacuum).
 *
 * Only runs when at least one adapter is configured; app.ts starts/stops it
 * inside the require.main block exactly like PaymentsSweeper.
 */
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  buildChannelRegistry,
  CHANNELS,
  type Channel,
  type ChannelRegistry,
} from './communication.adapters';

const DEFAULT_INTERVAL_MS = 60 * 1000; // every 60s
const MAX_ATTEMPTS = 5;
const MAX_PER_RUN = 50;
/** Ratified backoff ladder (minutes): 1, 5, 15, 60, 240 (cap). */
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 4 * 60 * 60_000];

interface WorkerOptions {
  intervalMs?: number;
  maxPerRun?: number;
  adapters?: ChannelRegistry;
}

export class NotificationDispatchWorker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly intervalMs: number;
  private readonly maxPerRun: number;
  private readonly adapters: ChannelRegistry;

  constructor(options: WorkerOptions = {}) {
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.maxPerRun = options.maxPerRun ?? MAX_PER_RUN;
    this.adapters = options.adapters ?? buildChannelRegistry();
  }

  isEnabled(): boolean {
    return CHANNELS.some((channel) => this.adapters[channel]?.isConfigured() === true);
  }

  start() {
    if (!this.isEnabled()) {
      logger.info('[NotificationDispatchWorker] Disabled (no communication adapter configured).');
      return;
    }
    if (this.timer) return;
    logger.info({ intervalMs: this.intervalMs, maxAttempts: MAX_ATTEMPTS }, '[NotificationDispatchWorker] Started.');
    this.timer = setInterval(() => void this.run(), this.intervalMs);
    this.timer.unref?.();
    void this.run();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Non-blocking immediate sweep (compose path). */
  kick(): void {
    if (this.isEnabled()) void this.run();
  }

  async run(): Promise<void> {
    if (!this.isEnabled() || this.running) return;
    this.running = true;
    try {
      const summary = await this.processDue();
      if (summary.claimed > 0) {
        logger.info(summary, '[NotificationDispatchWorker] Sweep complete.');
      }
    } catch (error) {
      logger.error({ err: error }, '[NotificationDispatchWorker] Sweep failed.');
    } finally {
      this.running = false;
    }
  }

  /** Claim due QUEUED deliveries and dispatch them. Exported seam for tests. */
  async processDue(now: Date = new Date()): Promise<{ claimed: number; sent: number; failed: number; retried: number }> {
    const due = await prisma.notificationDelivery.findMany({
      where: { status: 'QUEUED', nextAttemptAt: { lte: now } },
      orderBy: { nextAttemptAt: 'asc' },
      take: this.maxPerRun,
      select: {
        id: true,
        channel: true,
        recipient: true,
        attempts: true,
        announcement: { select: { title: true, body: true } },
      },
    });

    let sent = 0;
    let failed = 0;
    let retried = 0;

    for (const row of due) {
      const adapter = this.adapters[row.channel as Channel];
      const text = `${row.announcement.title}\n\n${row.announcement.body}`;

      if (!adapter || !adapter.isConfigured()) {
        await prisma.notificationDelivery.update({
          where: { id: row.id },
          data: { status: 'FAILED', attempts: row.attempts + 1, error: 'channel-disabled' },
        });
        failed += 1;
        continue;
      }

      const outcome = await adapter.send({
        to: row.recipient,
        subject: row.announcement.title,
        text,
      });

      const attempts = row.attempts + 1;
      if (outcome.ok) {
        await prisma.notificationDelivery.update({
          where: { id: row.id },
          data: {
            status: 'SENT',
            attempts,
            sentAt: now,
            providerMessageId: outcome.providerMessageId ?? null,
            error: null,
          },
        });
        sent += 1;
      } else if (attempts >= MAX_ATTEMPTS) {
        await prisma.notificationDelivery.update({
          where: { id: row.id },
          data: { status: 'FAILED', attempts, error: outcome.error ?? 'send-failed' },
        });
        failed += 1;
      } else {
        const delay = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length) - 1]!;
        await prisma.notificationDelivery.update({
          where: { id: row.id },
          data: {
            status: 'QUEUED',
            attempts,
            nextAttemptAt: new Date(now.getTime() + delay),
            error: outcome.error ?? 'send-failed',
          },
        });
        retried += 1;
      }
    }

    // Announcement rollups: QUEUED -> SENDING once work has begun; -> COMPLETED
    // when no QUEUED deliveries remain (individual FAILED rows keep the truth).
    await prisma.announcement.updateMany({
      where: { status: 'QUEUED', deliveries: { some: { status: { not: 'QUEUED' } } } },
      data: { status: 'SENDING' },
    });
    await prisma.announcement.updateMany({
      where: { status: { not: 'COMPLETED' }, deliveries: { none: { status: 'QUEUED' } } },
      data: { status: 'COMPLETED' },
    });

    return { claimed: due.length, sent, failed, retried };
  }
}

/** Process-wide singleton; app.ts starts/stops it inside require.main. */
export const notificationDispatchWorker = new NotificationDispatchWorker();
