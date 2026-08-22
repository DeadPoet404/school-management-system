#!/usr/bin/env python3
"""SMS-012 (backend): communication module -- announcements + delivery ledger +
adapter-based NotificationService (Arkesel SMS / Meta WhatsApp / email) +
retry worker (payments-sweeper pattern) + the ONE Prisma migration of the
twelve. Ratified: new Operations section, 60s/5-try/1m-5m-15m-1h(-4h cap)
backoff, EMAIL = guardian emails + student portal email (deduped).

Creates:
  prisma/migrations/20260805100000_sms012_communication/migration.sql
  src/modules/communication/communication.adapters.ts    -- ChannelAdapter iface + 3 adapters
  src/modules/communication/communication.worker.ts      -- retry/backoff dispatcher (+singleton)
  src/modules/communication/communication.service.ts     -- recipient resolution + queries
  src/modules/communication/communication.validation.ts  -- zod compose schema
  src/modules/communication/communication.controller.ts
  src/modules/communication/communication.routes.ts
  src/__tests__/unit/services/communication.test.ts      -- 14 tests
  docs/COMMUNICATION.md

Edits (anchors: clone bytes or my own prior-patch bytes -- all pre-verified):
  prisma/schema.prisma      -- append Announcement + NotificationDelivery models
  src/lib/env.ts            -- 5 new env vars (''-preprocess idiom + merge-back)
  src/app.ts                -- import/mount + worker start/stop in require.main
  docker-compose.yml        -- 5 pass-throughs
  sms-core-backend/.env.example, .env.example

DB applies automatically: docker-entrypoint runs `prisma migrate deploy`.

Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms012a.py
"""
from pathlib import Path

ROOT = Path(".")
BACKEND = Path("sms-core-backend")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)


def edit(path: Path, old: str, new: str, label: str, skip_marker: str) -> None:
    if not path.is_file():
        raise SystemExit(f"ABORT: {path} not found. Run from ~/sms-monorepo.")
    c = path.read_text(encoding="utf-8")
    if skip_marker in c:
        print(f"SKIP: {path} already patched ({label}).")
        return
    path.write_text(replace_once(c, old, new, label), encoding="utf-8")
    print(f"OK: {path}  ({label})")


def append_once(path: Path, block: str, label: str, skip_marker: str) -> None:
    if not path.is_file():
        raise SystemExit(f"ABORT: {path} not found.")
    c = path.read_text(encoding="utf-8")
    if skip_marker in c:
        print(f"SKIP: {path} already contains {label}.")
        return
    path.write_text(c.rstrip("\n") + "\n\n" + block.strip("\n") + "\n", encoding="utf-8")
    print(f"OK: {path}  ({label} appended)")


def create(path: Path, body: str) -> None:
    if path.exists():
        raise SystemExit(f"ABORT: {path} already exists. Refusing to overwrite.")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    print(f"OK: created {path}")


SCHEMA_MODELS = '''// ══════════════════════════════════════════════════════════════════════
// SMS-012 ── COMMUNICATION (announcements + durable delivery ledger)
// ══════════════════════════════════════════════════════════════════════

model Announcement {
  id             String   @id @default(uuid())
  title          String
  body           String   @db.Text
  /// SCHOOL_WIDE | CLASS | STUDENTS
  audience       String
  /// Required when audience = CLASS (canonical Class.id).
  classId        String?
  /// Internal Student.id list when audience = STUDENTS (Json string[]).
  studentIds     Json?
  /// Requested channels: Json string[] subset of SMS | WHATSAPP | EMAIL.
  channels       Json
  /// QUEUED -> SENDING -> COMPLETED (per-delivery FAILED rows stay visible).
  status         String   @default("QUEUED")
  createdBy      String
  createdByEmail String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  deliveries NotificationDelivery[]

  @@index([audience, createdAt])
}

model NotificationDelivery {
  id                String       @id @default(uuid())
  announcementId    String
  announcement      Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  /// SMS | WHATSAPP | EMAIL
  channel           String
  /// Phone number (SMS / WHATSAPP) or email address (EMAIL).
  recipient         String
  recipientLabel    String?
  /// Resolution-context student (null when not attributable to one).
  studentId         String?
  /// QUEUED | SENT | FAILED
  status            String       @default("QUEUED")
  attempts          Int          @default(0)
  nextAttemptAt     DateTime     @default(now())
  providerMessageId String?
  error             String?      @db.Text
  sentAt            DateTime?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  @@index([status, nextAttemptAt])
  @@index([announcementId])
}'''

MIGRATION_SQL = '''-- SMS-012: communication announcements + durable delivery ledger (only
-- schema change of the frozen backlog). Columns are TEXT/JSONB by design --
-- channel/status vocabularies are app-level String unions (schema precedent:
-- Payment.paymentType, Placement.academicTrack).

CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "classId" TEXT,
    "studentIds" JSONB,
    "channels" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "createdBy" TEXT NOT NULL,
    "createdByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "recipientLabel" TEXT,
    "studentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Announcement_audience_createdAt_idx" ON "Announcement"("audience", "createdAt");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");
CREATE INDEX "NotificationDelivery_announcementId_idx" ON "NotificationDelivery"("announcementId");

ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
'''

ADAPTERS = '''/**
 * SMS-012 — provider-agnostic channel adapters.
 *
 * Contract: every adapter is fail-soft. send() NEVER throws; it resolves
 * { ok:false, error } instead so the dispatch worker can record the failure
 * and schedule retries against the durable ledger. isConfigured() reads env
 * live (unset vars stay ''-normalized -> undefined -> channel disabled).
 *
 * Channel endpoints:
 *  - Arkesel SMS:      POST https://sms.arkesel.com/api/v2/sms/send (api-key header)
 *  - Meta WhatsApp:    POST https://graph.facebook.com/v19.0/{phoneNumberId}/messages
 *                      (ships disabled: Meta business verification + template
 *                      approval pending; freeform text only works inside the
 *                      24h customer-service window — see docs/COMMUNICATION.md)
 *  - Email:            delegates to lib/mailer.ts (SMS-006; never throws)
 */
import { logger } from '@/lib/logger';
import { isMailerConfigured, sendMail } from '@/lib/mailer';

export const CHANNELS = ['SMS', 'WHATSAPP', 'EMAIL'] as const;
export type Channel = (typeof CHANNELS)[number];

export interface SendInput {
  to: string;
  subject?: string;
  /** Plain-text message body (worker prefixes the announcement title). */
  text: string;
}

export interface SendOutcome {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface ChannelAdapter {
  readonly channel: Channel;
  isConfigured(): boolean;
  send(input: SendInput): Promise<SendOutcome>;
}

export type ChannelRegistry = Partial<Record<Channel, ChannelAdapter>>;

const ARKESEL_ENDPOINT = 'https://sms.arkesel.com/api/v2/sms/send';
const META_GRAPH_VERSION = 'v19.0';

function truncate(value: string, max = 300): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Ghana-local SMS delivery. */
export class ArkeselSmsAdapter implements ChannelAdapter {
  readonly channel = 'SMS' as const;

  isConfigured(): boolean {
    return Boolean(process.env.ARKESEL_API_KEY && process.env.ARKESEL_SENDER_ID);
  }

  async send(input: SendInput): Promise<SendOutcome> {
    if (!this.isConfigured()) return { ok: false, error: 'adapter-not-configured' };
    try {
      const res = await fetch(ARKESEL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.ARKESEL_API_KEY as string,
        },
        body: JSON.stringify({
          sender: process.env.ARKESEL_SENDER_ID,
          message: input.text,
          recipients: [input.to],
        }),
      });
      const payload = (await res.json().catch(() => null)) as {
        status?: string;
        data?: { id?: string }[] | null;
      } | null;
      const statusOk = !payload?.status || payload.status === 'success';
      if (res.ok && statusOk) {
        return { ok: true, providerMessageId: payload?.data?.[0]?.id ?? undefined };
      }
      return { ok: false, error: truncate(`arkesel HTTP ${res.status} status=${payload?.status ?? 'n/a'}`) };
    } catch (error) {
      logger.warn({ err: error }, '[SMS-012] Arkesel send raised');
      return { ok: false, error: error instanceof Error ? error.message : 'arkesel-send-error' };
    }
  }
}

/** Meta WhatsApp Cloud API (direct). Dark until env triple is provided. */
export class MetaWhatsAppAdapter implements ChannelAdapter {
  readonly channel = 'WHATSAPP' as const;

  isConfigured(): boolean {
    return Boolean(
      process.env.META_WA_PHONE_NUMBER_ID &&
        process.env.META_WA_ACCESS_TOKEN &&
        process.env.META_WA_BUSINESS_ACCOUNT_ID,
    );
  }

  async send(input: SendInput): Promise<SendOutcome> {
    if (!this.isConfigured()) return { ok: false, error: 'adapter-not-configured' };
    try {
      const endpoint = `https://graph.facebook.com/${META_GRAPH_VERSION}/${process.env.META_WA_PHONE_NUMBER_ID}/messages`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.META_WA_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: input.to,
          type: 'text',
          text: { body: input.text },
        }),
      });
      const payload = (await res.json().catch(() => null)) as {
        messages?: { id?: string }[] | null;
        error?: { message?: string } | null;
      } | null;
      if (res.ok) {
        return { ok: true, providerMessageId: payload?.messages?.[0]?.id ?? undefined };
      }
      return { ok: false, error: truncate(`meta-wa HTTP ${res.status} ${payload?.error?.message ?? ''}`.trim()) };
    } catch (error) {
      logger.warn({ err: error }, '[SMS-012] Meta WhatsApp send raised');
      return { ok: false, error: error instanceof Error ? error.message : 'meta-wa-send-error' };
    }
  }
}

/** Email channel -- thin delegate over the SMS-006 mailer (never throws). */
export class EmailAdapter implements ChannelAdapter {
  readonly channel = 'EMAIL' as const;

  isConfigured(): boolean {
    return isMailerConfigured();
  }

  async send(input: SendInput): Promise<SendOutcome> {
    if (!this.isConfigured()) return { ok: false, error: 'adapter-not-configured' };
    const result = await sendMail({
      to: input.to,
      subject: input.subject ?? 'School Notice',
      text: input.text,
      html: `<p>${escapeHtml(input.text).replace(/\\n/g, '<br>')}</p>`,
    });
    return result.sent
      ? { ok: true }
      : { ok: false, error: result.reason ?? 'email-send-failed' };
  }
}

/** Production registry (test-friendly: pass overrides to stub channels). */
export function buildChannelRegistry(overrides: ChannelRegistry = {}): ChannelRegistry {
  return {
    SMS: overrides.SMS ?? new ArkeselSmsAdapter(),
    WHATSAPP: overrides.WHATSAPP ?? new MetaWhatsAppAdapter(),
    EMAIL: overrides.EMAIL ?? new EmailAdapter(),
  };
}
'''

WORKER = '''/**
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
      const text = `${row.announcement.title}\\n\\n${row.announcement.body}`;

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
'''

SERVICE = '''/**
 * SMS-012 — communication service: recipient resolution + compose + ledger reads.
 *
 * Resolution matrix (ratified):
 *   audience SCHOOL_WIDE -> guardians of every ACTIVE student
 *   audience CLASS       -> guardians via placements of that class
 *   audience STUDENTS    -> guardians of the explicitly named students
 * Contact pick per channel (ratified):
 *   SMS / WHATSAPP -> Guardian.phone (required field)
 *   EMAIL          -> Guardian.email (when set) + the student's portal email
 * Dedupe per (channel, recipient); recipients resolved outside the create
 * transaction to keep the write window minimal.
 */
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middleware/error.handler';
import type { Channel } from './communication.adapters';

export interface ComposeInput {
  title: string;
  body: string;
  audience: 'SCHOOL_WIDE' | 'CLASS' | 'STUDENTS';
  classId?: string;
  studentIds?: string[];
  channels: Channel[];
}

export interface ComposeActor {
  id: string;
  email: string;
}

interface RecipientRow {
  channel: Channel;
  recipient: string;
  recipientLabel: string;
  studentId: string | null;
}

const studentSelect = {
  id: true,
  studentId: true,
  studentName: true,
  guardians: { select: { name: true, phone: true, email: true } },
  account: { select: { portalEmail: true } },
} as const;

type StudentWithContacts = {
  id: string;
  studentId: string;
  studentName: string;
  guardians: { name: string; phone: string; email: string | null }[];
  account: { portalEmail: string } | null;
};

export class CommunicationService {
  private async resolveStudents(input: ComposeInput): Promise<StudentWithContacts[]> {
    if (input.audience === 'SCHOOL_WIDE') {
      return prisma.student.findMany({
        where: { status: 'ACTIVE' },
        select: studentSelect,
      });
    }

    if (input.audience === 'CLASS') {
      const classRow = await prisma.class.findUnique({
        where: { id: input.classId },
        select: { id: true, name: true, deletedAt: true },
      });
      if (!classRow || classRow.deletedAt) {
        throw new AppError(404, `Class not found: ${input.classId}`);
      }
      const placements = await prisma.placement.findMany({
        where: { classId: classRow.id },
        select: { student: { select: studentSelect } },
      });
      return placements.map((placement) => placement.student);
    }

    const students = await prisma.student.findMany({
      where: { id: { in: input.studentIds ?? [] }, status: 'ACTIVE' },
      select: studentSelect,
    });
    if (students.length === 0) {
      throw new AppError(400, 'No matching ACTIVE students for the given studentIds.');
    }
    return students;
  }

  /** Guardians per audience; EMAIL adds the portal email (ratified). */
  buildRecipients(students: StudentWithContacts[], channels: Channel[]): RecipientRow[] {
    const wants = new Set(channels);
    const seen = new Set<string>();
    const rows: RecipientRow[] = [];

    const push = (channel: Channel, recipient: string | null, label: string, studentId: string) => {
      if (!recipient) return;
      const key = `${channel}|${recipient}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ channel, recipient, recipientLabel: label, studentId });
    };

    for (const student of students) {
      for (const guardian of student.guardians) {
        if (wants.has('SMS')) push('SMS', guardian.phone, guardian.name, student.id);
        if (wants.has('WHATSAPP')) push('WHATSAPP', guardian.phone, guardian.name, student.id);
        if (wants.has('EMAIL')) push('EMAIL', guardian.email, guardian.name, student.id);
      }
      if (wants.has('EMAIL')) {
        push('EMAIL', student.account?.portalEmail ?? null, student.studentName, student.id);
      }
    }
    return rows;
  }

  async compose(input: ComposeInput, actor: ComposeActor) {
    const students = await this.resolveStudents(input);
    const recipients = this.buildRecipients(students, input.channels);
    if (recipients.length === 0) {
      throw new AppError(
        400,
        'Audience resolved to zero recipients (no guardians/emails on record for the selected scope).',
      );
    }

    const announcement = await prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: {
          title: input.title,
          body: input.body,
          audience: input.audience,
          classId: input.audience === 'CLASS' ? input.classId ?? null : null,
          studentIds: input.audience === 'STUDENTS' ? input.studentIds ?? [] : [],
          channels: input.channels,
          status: 'QUEUED',
          createdBy: actor.id,
          createdByEmail: actor.email,
        },
      });
      await tx.notificationDelivery.createMany({
        data: recipients.map((row) => ({
          announcementId: created.id,
          channel: row.channel,
          recipient: row.recipient,
          recipientLabel: row.recipientLabel,
          studentId: row.studentId,
        })),
      });
      return created;
    });

    const channelCounts: Record<string, number> = {};
    for (const row of recipients) {
      channelCounts[row.channel] = (channelCounts[row.channel] ?? 0) + 1;
    }

    return {
      announcementId: announcement.id,
      status: announcement.status,
      audience: announcement.audience,
      studentsResolved: students.length,
      recipientCount: recipients.length,
      channelCounts,
    };
  }

  async listAnnouncements() {
    const rows = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        audience: true,
        channels: true,
        status: true,
        createdByEmail: true,
        createdAt: true,
        deliveries: { select: { status: true } },
      },
    });

    return rows.map((row) => {
      const counts = { queued: 0, sent: 0, failed: 0 };
      for (const delivery of row.deliveries) {
        if (delivery.status === 'SENT') counts.sent += 1;
        else if (delivery.status === 'FAILED') counts.failed += 1;
        else counts.queued += 1;
      }
      return {
        id: row.id,
        title: row.title,
        audience: row.audience,
        channels: row.channels,
        status: row.status,
        createdByEmail: row.createdByEmail,
        createdAt: row.createdAt.toISOString(),
        deliveryCounts: { ...counts, total: row.deliveries.length },
      };
    });
  }

  async getDeliveries(announcementId: string) {
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true, title: true, status: true },
    });
    if (!announcement) throw new AppError(404, `Announcement not found: ${announcementId}`);

    const deliveries = await prisma.notificationDelivery.findMany({
      where: { announcementId: announcement.id },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        channel: true,
        recipient: true,
        recipientLabel: true,
        status: true,
        attempts: true,
        providerMessageId: true,
        error: true,
        sentAt: true,
        updatedAt: true,
      },
    });

    return {
      announcement,
      deliveries: deliveries.map((row) => ({
        ...row,
        sentAt: row.sentAt ? row.sentAt.toISOString() : null,
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }
}
'''

VALIDATION = '''import { z } from 'zod';

export const composeAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required.').max(200),
    body: z.string().trim().min(1, 'Body is required.').max(4000),
    audience: z.enum(['SCHOOL_WIDE', 'CLASS', 'STUDENTS']),
    classId: z.string().uuid().optional(),
    studentIds: z.array(z.string().uuid()).max(200).optional(),
    channels: z
      .array(z.enum(['SMS', 'WHATSAPP', 'EMAIL']))
      .min(1, 'Pick at least one channel.'),
  })
  .superRefine((value, ctx) => {
    if (value.audience === 'CLASS' && !value.classId) {
      ctx.addIssue({
        code: 'custom',
        path: ['classId'],
        message: 'classId is required for CLASS announcements.',
      });
    }
    if (value.audience === 'STUDENTS' && (!value.studentIds || value.studentIds.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['studentIds'],
        message: 'studentIds must name at least one student for STUDENTS announcements.',
      });
    }
  });
'''

CONTROLLER = '''import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { CommunicationService } from './communication.service';
import { notificationDispatchWorker } from './communication.worker';

export class CommunicationController {
  private communicationService = new CommunicationService();

  /** POST /announcements -- ADMIN composes and sends (queues + immediate kick). */
  compose = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.communicationService.compose(req.body, {
        id: user.sub,
        email: user.email,
      });
      // Fire the worker now instead of waiting a full sweep interval.
      notificationDispatchWorker.kick();
      return res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  /** GET /announcements -- ADMIN + STAFF (read-only). */
  list = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.communicationService.listAnnouncements();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  /** GET /announcements/:id/deliveries -- ADMIN + STAFF (read-only). */
  deliveries = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.communicationService.getDeliveries(String(req.params.id));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
'''

ROUTES = '''import { Router } from 'express';
import { CommunicationController } from './communication.controller';
import { requireRole, ROLES } from '@/middleware/rbac.middleware';
import { validate } from '@/middleware/validate';
import { composeAnnouncementSchema } from './communication.validation';

const router = Router();
const controller = new CommunicationController();

// SMS-012: ADMIN composes/sends; STAFF reads the delivery ledger.
const composeAccess = requireRole(ROLES.ADMIN);
const readAccess = requireRole(ROLES.ADMIN, ROLES.STAFF);

router.post('/announcements', composeAccess, validate(composeAnnouncementSchema), controller.compose);
router.get('/announcements', readAccess, controller.list);
router.get('/announcements/:id/deliveries', readAccess, controller.deliveries);

export default router;
'''

DOC = '''# Communication — Announcements & Notices (SMS-012)

Provider-agnostic broadcast of school-wide / per-class / per-student notices
over **SMS (Arkesel)**, **WhatsApp (Meta Cloud API)** and **email** (SMS-006
mailer), with a durable per-recipient delivery ledger and an in-process retry
worker (payments-sweeper pattern). The only schema change of the twelve.

## Roles

| Action | Roles |
|---|---|
| `POST /api/communication/announcements` (compose + send) | **ADMIN** |
| `GET /api/communication/announcements` (list + counts)   | ADMIN, **STAFF** (read-only) |
| `GET /api/communication/announcements/:id/deliveries`    | ADMIN, **STAFF** (read-only) |

## Environment

| Var | Adapter | Notes |
|---|---|---|
| `ARKESEL_API_KEY` | SMS | Arkesel console API key. Blank = SMS channel disabled. |
| `ARKESEL_SENDER_ID` | SMS | Max 11 chars; must be approved on the Arkesel account. |
| `META_WA_PHONE_NUMBER_ID` | WhatsApp | Cloud API phone-number id. |
| `META_WA_ACCESS_TOKEN` | WhatsApp | System-user token with `whatsapp_business_messaging`. |
| `META_WA_BUSINESS_ACCOUNT_ID` | WhatsApp | WABA id (verification gate; adapter requires all three). |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Email | Reused from SMS-006. |

**Ship state:** unset variables keep a channel disabled — deliveries on it
fail permanently with `error: channel-disabled` (the ledger tells the truth
rather than retrying into a vacuum). The worker only runs when at least one
adapter is configured.

> **WhatsApp caveat (frozen-spec constraint).** Business-initiated WhatsApp
> messages require an approved *template*; the adapter's freeform `text` body
> only delivers inside the 24h customer-service window. SMS ships first, and
> swapping the WhatsApp payload to a template call is a one-file change in
> `communication.adapters.ts` once Meta verification completes.

## Recipient resolution (ratified)

| Audience | Recipients |
|---|---|
| `SCHOOL_WIDE` | Guardians of every ACTIVE student |
| `CLASS` (`classId`) | Guardians via placements of the class |
| `STUDENTS` (`studentIds`) | Guardians of the named ACTIVE students |

Contact pick per channel: SMS/WHATSAPP → `Guardian.phone`;
EMAIL → `Guardian.email` **+ the student's portal email** (deduped per
channel+recipient; matches the SMS-006 receipt-recipient rule).

## Compose example

```json
POST /api/communication/announcements
{
  "title": "Reopening — Term 1",
  "body": "School reopens Mon Sep 7 at 07:30. Full fee schedule attached in the portal.",
  "audience": "CLASS",
  "classId": "242b5c22-f270-46d4-9712-350e95e108f2",
  "channels": ["SMS", "EMAIL"]
}
```

`201` → `{ announcementId, status, studentsResolved, recipientCount, channelCounts }`.
The worker is kicked immediately (non-blocking) in addition to its 60s sweep.

## Delivery ledger semantics

| Field | Values |
|---|---|
| `status` | `QUEUED -> SENT | FAILED` (announcement rolls `QUEUED -> SENDING -> COMPLETED`) |
| `attempts` | 5 tries max; backoff **1m -> 5m -> 15m -> 1h** (4h ladder cap) |
| `nextAttemptAt` | next eligibility instant for the 60s sweep |
| `providerMessageId` | Arkesel `data[0].id` / Meta `messages[0].id` / (email: none) |
| `error` | last failure reason (`channel-disabled`, provider HTTP summary, …) |

Phone numbers are passed through as stored — keep Guardian records in
international (`+233…`) or local (`0…`) form per the Arkesel account rules.
'''

TESTS = '''/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use any for flexibility */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const { prismaMock, mailerSendMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn((arg: any) =>
      typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg),
    ),
    student: { findMany: vi.fn() },
    placement: { findMany: vi.fn() },
    class: { findUnique: vi.fn() },
    announcement: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    notificationDelivery: { findMany: vi.fn(), createMany: vi.fn(), update: vi.fn() },
  },
  mailerSendMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/mailer', () => ({
  sendMail: mailerSendMock,
  isMailerConfigured: () => mailerConfigured,
}));

let mailerConfigured = false;

import {
  ArkeselSmsAdapter,
  MetaWhatsAppAdapter,
  EmailAdapter,
  type ChannelAdapter,
} from '@/modules/communication/communication.adapters';
import { NotificationDispatchWorker } from '@/modules/communication/communication.worker';
import { CommunicationService } from '@/modules/communication/communication.service';
import { requireRole, ROLES } from '@/middleware/rbac.middleware';
import { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { AppError } from '@/middleware/error.handler';

const ENV_KEYS = [
  'ARKESEL_API_KEY',
  'ARKESEL_SENDER_ID',
  'META_WA_PHONE_NUMBER_ID',
  'META_WA_ACCESS_TOKEN',
  'META_WA_BUSINESS_ACCOUNT_ID',
];
const savedEnv: Record<string, string | undefined> = {};
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const service = new CommunicationService();

function stubAdapter(ok: boolean, extra: Partial<ChannelAdapter> = {}): ChannelAdapter {
  return {
    channel: 'SMS',
    isConfigured: () => true,
    send: vi.fn(async () =>
      ok ? { ok: true, providerMessageId: 'prov-1' } : { ok: false, error: 'boom' },
    ),
    ...extra,
  } as ChannelAdapter;
}

beforeEach(() => {
  vi.clearAllMocks();
  mailerConfigured = false;
  for (const key of ENV_KEYS) {
    if (!(key in savedEnv)) savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  prismaMock.student.findMany.mockResolvedValue([]);
  prismaMock.placement.findMany.mockResolvedValue([]);
  prismaMock.class.findUnique.mockResolvedValue(null);
  prismaMock.announcement.create.mockResolvedValue({ id: 'ann-1', status: 'QUEUED', audience: 'SCHOOL_WIDE' });
  prismaMock.announcement.findMany.mockResolvedValue([]);
  prismaMock.announcement.findUnique.mockResolvedValue(null);
  prismaMock.announcement.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.notificationDelivery.findMany.mockResolvedValue([]);
  prismaMock.notificationDelivery.createMany.mockResolvedValue({ count: 0 });
  prismaMock.notificationDelivery.update.mockResolvedValue({});
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
});

describe('channel adapters (SMS-012)', () => {
  it('Arkesel: unconfigured short-circuits without HTTP', async () => {
    const adapter = new ArkeselSmsAdapter();
    const outcome = await adapter.send({ to: '0244000000', text: 'hi' });
    expect(outcome).toEqual({ ok: false, error: 'adapter-not-configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Arkesel: posts the v2 payload with api-key header and maps data[0].id', async () => {
    process.env.ARKESEL_API_KEY = 'ark-key';
    process.env.ARKESEL_SENDER_ID = 'Horizon';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', data: [{ id: 'ark-msg-9' }] }),
    });

    const outcome = await new ArkeselSmsAdapter().send({ to: '0244000000', text: 'Reopen Monday' });

    expect(outcome).toEqual({ ok: true, providerMessageId: 'ark-msg-9' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://sms.arkesel.com/api/v2/sms/send');
    expect(init.headers['api-key']).toBe('ark-key');
    expect(JSON.parse(init.body)).toEqual({
      sender: 'Horizon',
      message: 'Reopen Monday',
      recipients: ['0244000000'],
    });
  });

  it('Arkesel: non-2xx surfaces a bounded provider error', async () => {
    process.env.ARKESEL_API_KEY = 'ark-key';
    process.env.ARKESEL_SENDER_ID = 'Horizon';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ status: 'error' }),
    });
    const outcome = await new ArkeselSmsAdapter().send({ to: 'x', text: 'y' });
    expect(outcome.ok).toBe(false);
    expect(String(outcome.error)).toContain('401');
  });

  it('Meta WA: posts text payload to the phone-number endpoint, maps messages[0].id', async () => {
    process.env.META_WA_PHONE_NUMBER_ID = 'pn-1';
    process.env.META_WA_ACCESS_TOKEN = 'tok';
    process.env.META_WA_BUSINESS_ACCOUNT_ID = 'waba-1';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.42' }] }),
    });

    const outcome = await new MetaWhatsAppAdapter().send({ to: '233244000000', text: 'Notice' });

    expect(outcome).toEqual({ ok: true, providerMessageId: 'wamid.42' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://graph.facebook.com/v19.0/pn-1/messages');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp',
      to: '233244000000',
      type: 'text',
      text: { body: 'Notice' },
    });
  });

  it('Email: delegates to the SMS-006 mailer (never throws)', async () => {
    mailerConfigured = true;
    mailerSendMock.mockResolvedValue({ sent: true });
    const outcome = await new EmailAdapter().send({ to: 'g@x.com', subject: 'Hi', text: 'Body' });
    expect(outcome).toEqual({ ok: true });
    expect(mailerSendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'g@x.com', subject: 'Hi', text: 'Body' }),
    );
  });
});

describe('recipient resolution (SMS-012)', () => {
  const students = [
    {
      id: 's1',
      studentId: 'HHA-2024-0001',
      studentName: 'Ama Yaw Osei',
      guardians: [
        { name: 'Mama Osei', phone: '0244000001', email: 'mama@x.com' },
        { name: 'Papa Osei', phone: '0244000002', email: null },
      ],
      account: { portalEmail: 'student001@horizon.local' },
    },
  ];

  it('SMS/WHATSAPP use guardian phones; EMAIL uses guardian emails + portal email', () => {
    const rows = service.buildRecipients(students as any, ['SMS', 'WHATSAPP', 'EMAIL']);
    const byChannel = (c: string) => rows.filter((r) => r.channel === c).map((r) => r.recipient);
    expect(byChannel('SMS')).toEqual(['0244000001', '0244000002']);
    expect(byChannel('WHATSAPP')).toEqual(['0244000001', '0244000002']);
    expect(byChannel('EMAIL')).toEqual(['mama@x.com', 'student001@horizon.local']);
  });

  it('dedupes a shared guardian email across students', () => {
    const twin = { ...students[0]!, id: 's2' };
    const rows = service.buildRecipients([students[0]!, twin] as any, ['EMAIL']);
    expect(rows.filter((r) => r.recipient === 'mama@x.com')).toHaveLength(1);
    expect(rows.filter((r) => r.recipient === 'student001@horizon.local')).toHaveLength(1);
  });

  it('CLASS audience 404s an unknown class; STUDENTS audience 400s zero matches', async () => {
    await expect(
      service.compose(
        { title: 't', body: 'b', audience: 'CLASS', classId: 'ghost', channels: ['SMS'] },
        { id: 'u1', email: 'admin@sms.local' },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      service.compose(
        { title: 't', body: 'b', audience: 'STUDENTS', studentIds: ['nobody'], channels: ['SMS'] },
        { id: 'u1', email: 'admin@sms.local' },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('compose persists announcement + ledger rows in one transaction', async () => {
    prismaMock.student.findMany.mockResolvedValue(students);

    const result = await service.compose(
      { title: 'Reopen', body: 'Monday 07:30', audience: 'SCHOOL_WIDE', channels: ['SMS', 'EMAIL'] },
      { id: 'u1', email: 'admin@sms.local' },
    );

    expect(result).toMatchObject({
      announcementId: 'ann-1',
      recipientCount: 4,
      channelCounts: { SMS: 2, EMAIL: 2 },
    });
    expect(prismaMock.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          audience: 'SCHOOL_WIDE',
          channels: ['SMS', 'EMAIL'],
          createdBy: 'u1',
          createdByEmail: 'admin@sms.local',
        }),
      }),
    );
    const ledger = prismaMock.notificationDelivery.createMany.mock.calls[0]![0] as any;
    expect(ledger.data).toHaveLength(4);
    expect(ledger.data.map((d: any) => d.channel).sort()).toEqual(['EMAIL', 'EMAIL', 'SMS', 'SMS']);
  });
});

describe('dispatch worker (SMS-012)', () => {
  const dueRow = (over: Record<string, unknown> = {}) => ({
    id: 'd1',
    channel: 'SMS',
    recipient: '0244000001',
    attempts: 0,
    announcement: { title: 'Reopen', body: 'Monday 07:30' },
    ...over,
  });

  const makeWorker = (adapters: any) =>
    new NotificationDispatchWorker({ adapters, maxPerRun: 10 });

  it('sends due rows and captures the provider message id', async () => {
    prismaMock.notificationDelivery.findMany.mockResolvedValue([dueRow()]);
    const worker = makeWorker({ SMS: stubAdapter(true) });
    const summary = await worker.processDue(new Date('2026-08-05T10:00:00Z'));

    expect(summary).toEqual({ claimed: 1, sent: 1, failed: 0, retried: 0 });
    const update = prismaMock.notificationDelivery.update.mock.calls[0]![0] as any;
    expect(update.data).toMatchObject({
      status: 'SENT',
      attempts: 1,
      providerMessageId: 'prov-1',
    });
    expect(prismaMock.announcement.updateMany).toHaveBeenCalledTimes(2);
  });

  it('failed send requeues with the 1-minute first backoff rung', async () => {
    prismaMock.notificationDelivery.findMany.mockResolvedValue([dueRow()]);
    const worker = makeWorker({ SMS: stubAdapter(false) });
    const now = new Date('2026-08-05T10:00:00Z');
    const summary = await worker.processDue(now);

    expect(summary).toEqual({ claimed: 1, sent: 0, failed: 0, retried: 1 });
    const update = prismaMock.notificationDelivery.update.mock.calls[0]![0] as any;
    expect(update.data.status).toBe('QUEUED');
    expect(update.data.attempts).toBe(1);
    expect(update.data.nextAttemptAt.getTime() - now.getTime()).toBe(60_000);
  });

  it('the 5th failure marks the delivery terminally FAILED', async () => {
    prismaMock.notificationDelivery.findMany.mockResolvedValue([dueRow({ attempts: 4 })]);
    const worker = makeWorker({ SMS: stubAdapter(false) });
    const summary = await worker.processDue(new Date());

    expect(summary).toEqual({ claimed: 1, sent: 0, failed: 1, retried: 0 });
    const update = prismaMock.notificationDelivery.update.mock.calls[0]![0] as any;
    expect(update.data.status).toBe('FAILED');
    expect(update.data.attempts).toBe(5);
  });

  it('unconfigured channel fails permanently with channel-disabled (no retry)', async () => {
    prismaMock.notificationDelivery.findMany.mockResolvedValue([dueRow({ channel: 'EMAIL' })]);
    const worker = makeWorker({ EMAIL: { channel: 'EMAIL', isConfigured: () => false, send: vi.fn() } });
    const summary = await worker.processDue(new Date());

    expect(summary).toEqual({ claimed: 1, sent: 0, failed: 1, retried: 0 });
    const update = prismaMock.notificationDelivery.update.mock.calls[0]![0] as any;
    expect(update.data).toMatchObject({ status: 'FAILED', error: 'channel-disabled' });
  });
});

describe('communication route role matrix (SMS-012)', () => {
  const mockRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });

  it('compose is ADMIN-only (STAFF rejected)', () => {
    const guard = requireRole(ROLES.ADMIN);
    const next = vi.fn();
    guard({ user: { role: 'STAFF' } } as AuthenticatedRequest, mockRes() as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next.mock.calls[0]![0]! as AppError).statusCode).toBe(403);
  });

  it('ledger reads allow ADMIN and STAFF, reject FACULTY', () => {
    const guard = requireRole(ROLES.ADMIN, ROLES.STAFF);
    let next = vi.fn();
    guard({ user: { role: 'STAFF' } } as AuthenticatedRequest, mockRes() as any, next);
    expect(next).toHaveBeenCalledWith();
    next = vi.fn();
    guard({ user: { role: 'FACULTY' } } as AuthenticatedRequest, mockRes() as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next.mock.calls[0]![0]! as AppError).statusCode).toBe(403);
  });
});
'''


def main() -> None:
    if not BACKEND.is_dir():
        raise SystemExit("ABORT: sms-core-backend/ not found. Run from ~/sms-monorepo.")
    if not (ROOT / "docker-compose.yml").is_file():
        raise SystemExit("ABORT: docker-compose.yml not found. Run from ~/sms-monorepo.")

    # ── Prisma schema + migration (the ONLY schema change of the twelve) ──
    append_once(
        BACKEND / "prisma/schema.prisma",
        SCHEMA_MODELS,
        "communication models",
        "model Announcement",
    )
    create(
        BACKEND / "prisma/migrations/20260805100000_sms012_communication/migration.sql",
        MIGRATION_SQL,
    )

    # ── Module files ──
    create(BACKEND / "src/modules/communication/communication.adapters.ts", ADAPTERS)
    create(BACKEND / "src/modules/communication/communication.worker.ts", WORKER)
    create(BACKEND / "src/modules/communication/communication.service.ts", SERVICE)
    create(BACKEND / "src/modules/communication/communication.validation.ts", VALIDATION)
    create(BACKEND / "src/modules/communication/communication.controller.ts", CONTROLLER)
    create(BACKEND / "src/modules/communication/communication.routes.ts", ROUTES)
    create(BACKEND / "src/__tests__/unit/services/communication.test.ts", TESTS)
    create(BACKEND / "docs/COMMUNICATION.md", DOC)

    # ── env.ts: 5 new optional vars (clone + my 010 bytes are known) ──
    edit(
        BACKEND / "src/lib/env.ts",
        "  CALENDAR_FEED_SECRET: z.preprocess(\n"
        "    (v) => (v === '' ? undefined : v),\n"
        "    z.string().min(32, 'CALENDAR_FEED_SECRET should be at least 32 random characters.').optional(),\n"
        "  ),\n",
        "  CALENDAR_FEED_SECRET: z.preprocess(\n"
        "    (v) => (v === '' ? undefined : v),\n"
        "    z.string().min(32, 'CALENDAR_FEED_SECRET should be at least 32 random characters.').optional(),\n"
        "  ),\n"
        "  // SMS-012: communication adapters -- unset channels stay disabled (channel-disabled).\n"
        "  ARKESEL_API_KEY: z.preprocess(\n"
        "    (v) => (v === '' ? undefined : v),\n"
        "    z.string().min(1).optional(),\n"
        "  ),\n"
        "  ARKESEL_SENDER_ID: z.preprocess(\n"
        "    (v) => (v === '' ? undefined : v),\n"
        "    z.string().max(11, 'ARKESEL_SENDER_ID must be 11 characters or fewer.').optional(),\n"
        "  ),\n"
        "  META_WA_PHONE_NUMBER_ID: z.preprocess(\n"
        "    (v) => (v === '' ? undefined : v),\n"
        "    z.string().min(1).optional(),\n"
        "  ),\n"
        "  META_WA_ACCESS_TOKEN: z.preprocess(\n"
        "    (v) => (v === '' ? undefined : v),\n"
        "    z.string().min(1).optional(),\n"
        "  ),\n"
        "  META_WA_BUSINESS_ACCOUNT_ID: z.preprocess(\n"
        "    (v) => (v === '' ? undefined : v),\n"
        "    z.string().min(1).optional(),\n"
        "  ),\n",
        "env: adapter secrets schema",
        "ARKESEL_API_KEY: z.preprocess",
    )
    edit(
        BACKEND / "src/lib/env.ts",
        "  if (env.CALENDAR_FEED_SECRET) process.env.CALENDAR_FEED_SECRET = env.CALENDAR_FEED_SECRET;\n",
        "  if (env.CALENDAR_FEED_SECRET) process.env.CALENDAR_FEED_SECRET = env.CALENDAR_FEED_SECRET;\n"
        "  if (env.ARKESEL_API_KEY) process.env.ARKESEL_API_KEY = env.ARKESEL_API_KEY;\n"
        "  if (env.ARKESEL_SENDER_ID) process.env.ARKESEL_SENDER_ID = env.ARKESEL_SENDER_ID;\n"
        "  if (env.META_WA_PHONE_NUMBER_ID) process.env.META_WA_PHONE_NUMBER_ID = env.META_WA_PHONE_NUMBER_ID;\n"
        "  if (env.META_WA_ACCESS_TOKEN) process.env.META_WA_ACCESS_TOKEN = env.META_WA_ACCESS_TOKEN;\n"
        "  if (env.META_WA_BUSINESS_ACCOUNT_ID) process.env.META_WA_BUSINESS_ACCOUNT_ID = env.META_WA_BUSINESS_ACCOUNT_ID;\n",
        "env: adapter secrets merge-back",
        "if (env.ARKESEL_API_KEY)",
    )

    # ── compose + env examples ──
    edit(
        ROOT / "docker-compose.yml",
        "      # -- Class Timetable Calendar Feeds (SMS-010) --\n"
        "      CALENDAR_FEED_SECRET: ${CALENDAR_FEED_SECRET:-}\n",
        "      # -- Class Timetable Calendar Feeds (SMS-010) --\n"
        "      CALENDAR_FEED_SECRET: ${CALENDAR_FEED_SECRET:-}\n"
        "      # -- Communication adapters (SMS-012; blank = channel disabled) --\n"
        "      ARKESEL_API_KEY: ${ARKESEL_API_KEY:-}\n"
        "      ARKESEL_SENDER_ID: ${ARKESEL_SENDER_ID:-}\n"
        "      META_WA_PHONE_NUMBER_ID: ${META_WA_PHONE_NUMBER_ID:-}\n"
        "      META_WA_ACCESS_TOKEN: ${META_WA_ACCESS_TOKEN:-}\n"
        "      META_WA_BUSINESS_ACCOUNT_ID: ${META_WA_BUSINESS_ACCOUNT_ID:-}\n",
        "compose adapter pass-throughs",
        "ARKESEL_API_KEY:",
    )
    append_once(
        BACKEND / ".env.example",
        "# -- Communication adapters (SMS-012) -------------------------------\n"
        "# Leave any blank to keep that channel disabled (deliveries then fail\n"
        "# permanently with error 'channel-disabled' -- ledger tells the truth).\n"
        "# SMS via Arkesel (Ghana-local). Sender id max 11 chars, must be approved.\n"
        "ARKESEL_API_KEY=\n"
        "ARKESEL_SENDER_ID=\n"
        "# WhatsApp via Meta Cloud API -- requires Meta business verification +\n"
        "# template approval; adapter stays dark until all three are set.\n"
        "META_WA_PHONE_NUMBER_ID=\n"
        "META_WA_ACCESS_TOKEN=\n"
        "META_WA_BUSINESS_ACCOUNT_ID=",
        "communication env block",
        "ARKESEL_API_KEY",
    )
    append_once(
        ROOT / ".env.example",
        "# -- Communication adapters (SMS-012; passed through to the backend) ---\n"
        "ARKESEL_API_KEY=\n"
        "ARKESEL_SENDER_ID=\n"
        "META_WA_PHONE_NUMBER_ID=\n"
        "META_WA_ACCESS_TOKEN=\n"
        "META_WA_BUSINESS_ACCOUNT_ID=",
        "communication env block",
        "ARKESEL_API_KEY",
    )

    # ── app.ts: import, mount, worker start/stop ──
    edit(
        BACKEND / "src/app.ts",
        "import analyticsRoutes from './modules/analytics/analytics.routes';\n",
        "import analyticsRoutes from './modules/analytics/analytics.routes';\n"
        "import communicationRoutes from './modules/communication/communication.routes';\n"
        "import { notificationDispatchWorker } from './modules/communication/communication.worker';\n",
        "app communication imports",
        "communicationRoutes",
    )
    edit(
        BACKEND / "src/app.ts",
        "app.use('/api/analytics', authenticate, analyticsRoutes);\n",
        "app.use('/api/analytics', authenticate, analyticsRoutes);\n"
        "app.use('/api/communication', authenticate, communicationRoutes);\n",
        "app communication mount",
        "app.use('/api/communication'",
    )
    edit(
        BACKEND / "src/app.ts",
        "    startBlocklistCleanup();\n"
        "    paymentSweeper = new PaymentsSweeper();\n"
        "    paymentSweeper.start();\n",
        "    startBlocklistCleanup();\n"
        "    paymentSweeper = new PaymentsSweeper();\n"
        "    paymentSweeper.start();\n"
        "    // SMS-012: durable notification dispatch (60s sweep + compose-time kicks)\n"
        "    notificationDispatchWorker.start();\n",
        "app worker start",
        "notificationDispatchWorker.start()",
    )
    edit(
        BACKEND / "src/app.ts",
        "    paymentSweeper?.stop();\n",
        "    paymentSweeper?.stop();\n"
        "    notificationDispatchWorker.stop();\n",
        "app worker stop",
        "notificationDispatchWorker.stop()",
    )

    print()
    print("SMS-012 backend applied (incl. migration folder; entrypoint's migrate deploy")
    print("applies it on next backend container start). Next: gates, rebuild, smoke.")
    print("APPLY012_EXIT=0")


if __name__ == "__main__":
    main()
