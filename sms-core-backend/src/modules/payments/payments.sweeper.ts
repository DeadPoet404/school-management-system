import { PaymentIntentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { PaystackClient } from './paystack.client';
import { PaymentsReconciliationService } from './payments.reconciliation.service';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const DEFAULT_GRACE_MS = 10 * 60 * 1000;   // sweep intents at least 10 min old

interface SweeperOptions {
  intervalMs?: number;
  graceMs?: number;
  maxPerRun?: number;
}

/**
 * Background reconciliation sweeper.
 *
 * Finds intents still PENDING/INITIALIZED past the grace period and re-verifies
 * them with Paystack, settling through the shared idempotent path. This is the
 * backstop for bank transfers / lost webhooks / deferred MoMo approvals — cases
 * where no browser ever returns to the site. Only runs when Paystack is
 * configured (no secret key => digital payments are disabled).
 */
export class PaymentsSweeper {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly intervalMs: number;
  private readonly graceMs: number;
  private readonly maxPerRun: number;
  private readonly paystack: PaystackClient;
  private readonly reconciliation: PaymentsReconciliationService;

  constructor(options: SweeperOptions = {}) {
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
    this.maxPerRun = options.maxPerRun ?? 25;
    this.paystack = new PaystackClient();
    this.reconciliation = new PaymentsReconciliationService(
      this.paystack,
    );
  }

  isEnabled(): boolean {
    return this.paystack.isConfigured();
  }

  start() {
    if (!this.isEnabled()) {
      logger.info('[PaymentSweeper] Disabled (no PAYSTACK_SECRET_KEY set).');
      return;
    }
    if (this.timer) return;

    logger.info(
      { intervalMs: this.intervalMs, graceMs: this.graceMs },
      '[PaymentSweeper] Started.',
    );
    this.timer = setInterval(() => void this.run(), this.intervalMs);
    // First sweep shortly after boot rather than waiting a full interval.
    this.timer.unref?.();
    void this.run();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async run() {
    if (!this.isEnabled() || this.running) return;
    this.running = true;

    const cutoff = new Date(Date.now() - this.graceMs);

    try {
      const pending = await prisma.paymentIntent.findMany({
        where: {
          status: { in: [PaymentIntentStatus.PENDING, PaymentIntentStatus.INITIALIZED] },
          createdAt: { lt: cutoff },
        },
        orderBy: { createdAt: 'asc' },
        take: this.maxPerRun,
        select: { reference: true },
      });

      if (pending.length === 0) return;

      logger.info(
        { count: pending.length },
        '[PaymentSweeper] Verifying stale pending intents.',
      );

      for (const intent of pending) {
        try {
          await this.reconciliation.verifyAndReconcileByReference(intent.reference);
          logger.info(
            { reference: intent.reference },
            '[PaymentSweeper] Settled intent.',
          );
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'Sweeper verify failed.';
          logger.warn(
            { reference: intent.reference, reason },
            '[PaymentSweeper] Intent not settled (will retry next cycle).',
          );
        }
      }
    } catch (err) {
      logger.error(
        { err },
        '[PaymentSweeper] Sweep failed to query pending intents.',
      );
    } finally {
      this.running = false;
    }
  }
}
