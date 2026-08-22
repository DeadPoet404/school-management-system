#!/usr/bin/env python3
"""SMS-006 (backend): receipt emails via Nodemailer over Gmail SMTP — fail-soft.

Creates:
  src/lib/mailer.ts         -- lazy Gmail SMTP singleton; sendMail never throws
  src/lib/receipt-email.ts  -- recipient resolution + branded templates + orchestrator
  src/__tests__/unit/lib/receipt-mail.test.ts -- stubbed-transport suites (10 tests)

Edits (anchors verified against the CURRENT user files / my clone + SMS-004 patch history):
  src/lib/env.ts                              -- GMAIL_USER / GMAIL_APP_PASSWORD (optional, ''-normalized)
  sms-core-backend/.env.example               -- Gmail setup note (2FA + App Password)
  .env.example (root)                         -- compose pass-through note
  docker-compose.yml                          -- backend env pass-throughs
  src/modules/finance/finance.service.ts      -- trigger (a): post-commit dynamic-import send, manual path only
  src/modules/payments/payments.reconciliation.service.ts
                                              -- trigger (b): capture + propagate collectionId;
                                                 post-commit send in verifyAndReconcileByReference

Prereq (RUN FIRST in sms-core-backend):
  npm install nodemailer && npm install -D @types/nodemailer

Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms006a.py
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


MAILER = '''/**
 * SMS-006 -- Nodemailer transport factory + send API over Gmail SMTP.
 *
 * Design contract (frozen backlog):
 *  - Env-validated credentials (GMAIL_USER / GMAIL_APP_PASSWORD) at boot.
 *  - Dispatch is post-commit, asynchronous and FAIL-SOFT: sendMail() never
 *    throws. A payment must never roll back on mail failure; failures are
 *    captured by the pino logger instead.
 *  - Unconfigured credentials => every send is skipped with a warn log
 *    (dev machines and CI need no Gmail secrets).
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { logger } from '@/lib/logger';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface OutboundMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: MailAttachment[];
}

export interface SendResult {
  sent: boolean;
  /** Present when sent === false: 'unconfigured' | provider error message. */
  reason?: string;
}

export function isMailerConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter === undefined) {
    transporter = isMailerConfigured()
      ? nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        })
      : null;
  }
  return transporter;
}

/** Test hook: drop the cached transport between cases. */
export function __resetMailerForTesting(): void {
  transporter = undefined;
}

export async function sendMail(mail: OutboundMail): Promise<SendResult> {
  const tx = getTransporter();
  if (!tx) {
    logger.warn('[mailer] Gmail credentials not configured — email skipped.');
    return { sent: false, reason: 'unconfigured' };
  }
  try {
    await tx.sendMail({
      from: `"School Management System" <${process.env.GMAIL_USER}>`,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { sent: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown SMTP failure.';
    logger.error({ err: error, to: mail.to, subject: mail.subject }, '[mailer] SMTP send failed.');
    return { sent: false, reason };
  }
}
'''

RECEIPT_EMAIL = '''/**
 * SMS-006 -- receipt dispatch orchestrator.
 *
 * Both payment channels fire here post-commit (fire-and-forget):
 *   (a) finance.service.ts  -> cash counter collections
 *   (b) payments.reconciliation.service.ts -> verified Paystack settlements
 *
 * Recipients (frozen backlog): the student's portal email + every guardian
 * email on file, deduplicated. With zero recipients the send is skipped and
 * logged. The attached PDF is the IDENTICAL artifact the SMS-007 endpoint
 * renders on demand -- regenerated here via the same pipeline.
 */
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { FinanceService } from '@/modules/finance/finance.service';
import { renderReceiptPdf, type ReceiptPdfData } from '@/lib/pdf';
import { sendMail } from '@/lib/mailer';

export const RECEIPT_CHANNEL_LABELS = {
  CASH: 'Cash counter collection',
  PAYSTACK: 'Paystack digital payment',
} as const;

export type ReceiptChannel = keyof typeof RECEIPT_CHANNEL_LABELS;

export async function resolveReceiptRecipients(studentInternalId: string | null): Promise<string[]> {
  if (!studentInternalId) return [];
  const student = await prisma.student.findUnique({
    where: { id: studentInternalId },
    select: {
      account: { select: { portalEmail: true } },
      guardians: { select: { email: true } },
    },
  });
  if (!student) return [];
  const emails = new Set<string>();
  if (student.account?.portalEmail) emails.add(student.account.portalEmail);
  for (const guardian of student.guardians) {
    if (guardian.email) emails.add(guardian.email);
  }
  return [...emails];
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number): string {
  return n.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
}

function buildText(dto: ReceiptPdfData, channel: ReceiptChannel): string {
  return [
    `OFFICIAL PAYMENT RECEIPT — ${dto.receiptNumber}`,
    '',
    `Dear ${dto.studentName},`,
    '',
    `This confirms your fee payment (${RECEIPT_CHANNEL_LABELS[channel]}).`,
    '',
    `Receipt No:  ${dto.receiptNumber}`,
    `Date:        ${new Date(dto.dateProcessed).toISOString().slice(0, 10)}`,
    `Amount Paid: GHS ${money(dto.amountPaid)}`,
    `Method:      ${dto.paymentMethod}`,
    `Allocation:  ${dto.allocationTarget}`,
    dto.outstandingBalance === null
      ? null
      : `Outstanding Balance: GHS ${money(dto.outstandingBalance)}`,
    '',
    'The official PDF receipt is attached.',
    '',
    '— Institutional Collections & Receipting Office',
  ]
    .filter((line): line is string => line !== null)
    .join('\\n');
}

function buildHtml(dto: ReceiptPdfData, channel: ReceiptChannel): string {
  const rows: Array<[string, string]> = [
    ['Receipt No', esc(dto.receiptNumber)],
    ['Date Issued', esc(new Date(dto.dateProcessed).toISOString().slice(0, 10))],
    ['Student', esc(dto.studentName)],
    ['Student ID', esc(dto.studentCode ?? 'Not linked')],
    ['Class', esc(dto.className ?? 'N/A')],
    ['Amount Paid', `GHS ${money(dto.amountPaid)}`],
    ['Payment Channel', esc(RECEIPT_CHANNEL_LABELS[channel])],
    ['Method', esc(dto.paymentMethod)],
    ['Allocation', esc(dto.allocationTarget)],
    [
      'Outstanding Balance',
      dto.outstandingBalance === null ? 'N/A' : `GHS ${money(dto.outstandingBalance)}`,
    ],
  ];
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;color:#666;font-size:13px;">${k}</td>` +
        `<td style="padding:6px 12px;font-size:13px;font-weight:600;">${v}</td></tr>`,
    )
    .join('');
  return (
    '<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">' +
    '<div style="background:#1a1a1a;color:#fff;padding:16px 20px;">' +
    '<div style="font-size:15px;font-weight:700;letter-spacing:.4px;">SCHOOL MANAGEMENT SYSTEM</div>' +
    '<div style="font-size:11px;color:#bbb;">Institutional Collections &amp; Receipting Office</div></div>' +
    '<div style="padding:20px;">' +
    `<p style="font-size:13px;color:#333;">Dear ${esc(dto.studentName)},</p>` +
    '<p style="font-size:13px;color:#333;">This confirms your fee payment. The official PDF receipt is attached to this email.</p>' +
    `<table style="width:100%;border-collapse:collapse;border:1px solid #eee;">${body}</table>` +
    '<p style="font-size:11px;color:#999;margin-top:16px;">Generated on demand from live ledger data. Please retain the attached receipt for your records.</p>' +
    '</div></div>'
  );
}

/**
 * Fail-soft by contract: NEVER throws. Callers fire with `void` + .catch as a
 * final belt, but every failure path here is logged and swallowed already.
 */
export async function sendCollectionReceipt(collectionId: string, channel: ReceiptChannel): Promise<void> {
  const logContext = { collectionId, channel };
  try {
    const record = await prisma.paymentCollection.findUnique({
      where: { id: collectionId },
      select: { studentInternalId: true },
    });
    if (!record) {
      logger.warn(logContext, '[SMS-006] Receipt email skipped — collection record not found.');
      return;
    }

    const recipients = await resolveReceiptRecipients(record.studentInternalId);
    if (recipients.length === 0) {
      logger.info(logContext, '[SMS-006] Receipt email skipped — no recipients on file for this student.');
      return;
    }

    const dto = await new FinanceService().getReceiptForPdf(collectionId);
    const pdf = await renderReceiptPdf(dto);
    const result = await sendMail({
      to: recipients.join(', '),
      subject: `Payment Receipt ${dto.receiptNumber} — ${RECEIPT_CHANNEL_LABELS[channel]}`,
      text: buildText(dto, channel),
      html: buildHtml(dto, channel),
      attachments: [
        {
          filename: `receipt-${dto.receiptNumber}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });

    if (result.sent) {
      logger.info({ ...logContext, recipients }, '[SMS-006] Receipt email dispatched.');
    } else {
      logger.warn({ ...logContext, reason: result.reason }, '[SMS-006] Receipt email not sent.');
    }
  } catch (error) {
    logger.error({ ...logContext, err: error }, '[SMS-006] Receipt email dispatch failed (swallowed).');
  }
}
'''

RECEIPT_MAIL_TESTS = '''/**
 * SMS-006 suites — mailer transport + receipt-email orchestrator.
 *
 * Mocking strategy: mock nodemailer (the wire), prisma, lib/pdf, and the
 * logger — but exercise the REAL lib/mailer underneath. That keeps the
 * fail-soft contract ('sendMail never throws') under direct test instead of
 * mocking away the very unit under test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTransportSend, mockCreateTransport, mockRenderReceiptPdf, mockLogger, prismaMock, DTO } =
  vi.hoisted(() => {
    const mockTransportSend = vi.fn();
    return {
      mockTransportSend,
      mockCreateTransport: vi.fn(() => ({ sendMail: mockTransportSend })),
      mockRenderReceiptPdf: vi.fn(),
      mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      prismaMock: {
        student: { findUnique: vi.fn() },
        paymentCollection: { findUnique: vi.fn() },
      },
      DTO: {
        receiptNumber: 'REC-2026-0099',
        dateProcessed: new Date('2026-08-05T10:00:00.000Z'),
        studentName: 'Ama Yaw Osei',
        studentCode: 'HHA-2024-0001',
        className: 'JHS 1A — Section A',
        amountPaid: 1234.56,
        paymentMethod: 'CASH',
        referenceNo: 'N/A (Direct)',
        allocationTarget: 'Tuition - Term 1',
        outstandingBalance: 765.44,
      },
    };
  });

vi.mock('nodemailer', () => ({ default: { createTransport: mockCreateTransport } }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/pdf', () => ({ renderReceiptPdf: mockRenderReceiptPdf }));
vi.mock('@/modules/finance/finance.service', () => ({
  FinanceService: class {
    async getReceiptForPdf() {
      return DTO;
    }
  },
}));

import { sendMail, __resetMailerForTesting } from '@/lib/mailer';
import { sendCollectionReceipt, resolveReceiptRecipients } from '@/lib/receipt-email';

describe('mailer transport (SMS-006)', () => {
  beforeEach(() => {
    __resetMailerForTesting();
    vi.clearAllMocks();
    mockTransportSend.mockResolvedValue({ messageId: 'msg-1' });
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
  });

  it('is skipped and logged when Gmail credentials are unconfigured', async () => {
    const result = await sendMail({ to: 'a@b.c', subject: 's', text: 't', html: '<p>t</p>' });
    expect(result).toEqual({ sent: false, reason: 'unconfigured' });
    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('sends through the Gmail transporter with a branded sender when configured', async () => {
    process.env.GMAIL_USER = 'school@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'app-password-16';
    const result = await sendMail({ to: 'a@b.c', subject: 'Hello', text: 't', html: '<p>t</p>' });
    expect(result.sent).toBe(true);
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.gmail.com', port: 465, secure: true }),
    );
    expect(mockTransportSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: '"School Management System" <school@gmail.com>', to: 'a@b.c', subject: 'Hello' }),
    );
  });

  it('swallows SMTP failures and logs them (fail-soft, never throws)', async () => {
    process.env.GMAIL_USER = 'school@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'app-password-16';
    mockTransportSend.mockRejectedValue(new Error('535 Bad credentials'));
    const result = await sendMail({ to: 'a@b.c', subject: 's', text: 't', html: '<p>t</p>' });
    expect(result).toEqual({ sent: false, reason: '535 Bad credentials' });
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe('receipt-email orchestrator (SMS-006)', () => {
  beforeEach(() => {
    __resetMailerForTesting();
    vi.clearAllMocks();
    process.env.GMAIL_USER = 'school@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'app-password-16';
    mockTransportSend.mockResolvedValue({ messageId: 'msg-2' });
    mockRenderReceiptPdf.mockResolvedValue(Buffer.from('%PDF-mock'));
    prismaMock.paymentCollection.findUnique.mockResolvedValue({ studentInternalId: 'stu-1' });
    prismaMock.student.findUnique.mockResolvedValue({
      account: { portalEmail: 'student001@horizon.local' },
      guardians: [
        { email: 'guardian1@example.com' },
        { email: null },
        { email: 'student001@horizon.local' }, // duplicate of portal email — must dedupe
      ],
    });
  });

  it('sends to portal email + guardian emails, deduplicated, with the PDF attached', async () => {
    await sendCollectionReceipt('col-1', 'CASH');
    expect(mockTransportSend).toHaveBeenCalledTimes(1);
    const mail = mockTransportSend.mock.calls[0][0];
    expect(mail.from).toBe('"School Management System" <school@gmail.com>');
    expect(mail.to).toBe('student001@horizon.local, guardian1@example.com');
    expect(mail.subject).toContain('REC-2026-0099');
    expect(mail.subject).toContain('Cash counter collection');
    expect(mail.html).toContain('Ama Yaw Osei');
    expect(mail.text).toContain('GHS 1,234.56');
    expect(mail.attachments).toEqual([
      { filename: 'receipt-REC-2026-0099.pdf', content: expect.any(Buffer), contentType: 'application/pdf' },
    ]);
    expect(mockRenderReceiptPdf).toHaveBeenCalledWith(DTO);
  });

  it('renders the Paystack channel label for digital settlements', async () => {
    await sendCollectionReceipt('col-9', 'PAYSTACK');
    expect(mockTransportSend.mock.calls[0][0].subject).toContain('Paystack digital payment');
  });

  it('skips and logs when the student has zero recipients on file', async () => {
    prismaMock.student.findUnique.mockResolvedValue({ account: null, guardians: [] });
    await sendCollectionReceipt('col-2', 'CASH');
    expect(mockTransportSend).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ collectionId: 'col-2' }),
      expect.stringContaining('no recipients'),
    );
  });

  it('skips walk-in collections with no linked student', async () => {
    prismaMock.paymentCollection.findUnique.mockResolvedValue({ studentInternalId: null });
    await sendCollectionReceipt('col-4', 'CASH');
    expect(mockTransportSend).not.toHaveBeenCalled();
  });

  it('skips gracefully when the collection row is gone', async () => {
    prismaMock.paymentCollection.findUnique.mockResolvedValue(null);
    await sendCollectionReceipt('col-gone', 'CASH');
    expect(mockTransportSend).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('does not send (and stays resolved) when Gmail is unconfigured', async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    __resetMailerForTesting();
    await expect(sendCollectionReceipt('col-6', 'CASH')).resolves.toBeUndefined();
    expect(mockTransportSend).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('swallows unexpected orchestrator errors and logs them', async () => {
    mockRenderReceiptPdf.mockRejectedValue(new Error('pdf exploded'));
    await expect(sendCollectionReceipt('col-7', 'CASH')).resolves.toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ collectionId: 'col-7' }),
      expect.stringContaining('swallowed'),
    );
  });

  it('resolveReceiptRecipients returns portal + guardian emails in order', async () => {
    await expect(resolveReceiptRecipients('stu-1')).resolves.toEqual([
      'student001@horizon.local',
      'guardian1@example.com',
    ]);
    await expect(resolveReceiptRecipients(null)).resolves.toEqual([]);
  });
});
'''


def main() -> None:
    if not BACKEND.is_dir():
        raise SystemExit("ABORT: sms-core-backend/ not found. Run from ~/sms-monorepo.")

    create(BACKEND / "src/lib/mailer.ts", MAILER)
    create(BACKEND / "src/lib/receipt-email.ts", RECEIPT_EMAIL)
    create(BACKEND / "src/__tests__/unit/lib/receipt-mail.test.ts", RECEIPT_MAIL_TESTS)

    # ── lib/env.ts ──
    edit(
        BACKEND / "src/lib/env.ts",
        "  GOOGLE_CLIENT_ID: z.preprocess(\n"
        "    (v) => (v === '' ? undefined : v),\n"
        "    z.string().min(1).optional(),\n"
        "  ),\n",
        "  GOOGLE_CLIENT_ID: z.preprocess(\n"
        "    (v) => (v === '' ? undefined : v),\n"
        "    z.string().min(1).optional(),\n"
        "  ),\n"
        "  // SMS-006: Gmail SMTP credentials for receipt dispatch (Nodemailer).\n"
        "  // Optional pair -- receipt emails are skipped (logged) when unset.\n"
        "  // Same ''-normalization as GOOGLE_CLIENT_ID (compose passes unset\n"
        "  // pass-throughs as empty strings, and min(1) would crash boot).\n"
        "  GMAIL_USER: z.preprocess(\n"
        "    (v) => (v === '' ? undefined : v),\n"
        "    z.string().min(1).optional(),\n"
        "  ),\n"
        "  GMAIL_APP_PASSWORD: z.preprocess(\n"
        "    (v) => (v === '' ? undefined : v),\n"
        "    z.string().min(1).optional(),\n"
        "  ),\n",
        "env: Gmail schema",
        "GMAIL_USER: z.preprocess",
    )
    edit(
        BACKEND / "src/lib/env.ts",
        "  if (env.GOOGLE_CLIENT_ID) process.env.GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;\n",
        "  if (env.GOOGLE_CLIENT_ID) process.env.GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;\n"
        "  if (env.GMAIL_USER) process.env.GMAIL_USER = env.GMAIL_USER;\n"
        "  if (env.GMAIL_APP_PASSWORD) process.env.GMAIL_APP_PASSWORD = env.GMAIL_APP_PASSWORD;\n",
        "env: Gmail merge-back",
        "if (env.GMAIL_USER)",
    )

    # ── env examples ──
    append_once(
        BACKEND / ".env.example",
        "# -- Receipt Emails via Gmail SMTP (SMS-006) ------------------------------\n"
        "# Nodemailer transport for receipts on cash collection and Paystack\n"
        "# reconciliation. Requires a Gmail account with 2-Step Verification ON,\n"
        "# then an App Password (Google Account -> Security -> App passwords).\n"
        "# Leave blank to keep dispatch disabled (sends are skipped and logged).\n"
        "GMAIL_USER=\n"
        "GMAIL_APP_PASSWORD=",
        "Gmail SMTP block",
        "GMAIL_USER",
    )
    append_once(
        ROOT / ".env.example",
        "# -- Receipt Emails via Gmail SMTP (SMS-006) ------------------------------\n"
        "# Passed through to the backend container (see sms-core-backend/.env.example\n"
        "# for the 2FA + App Password setup). Leave blank to keep dispatch disabled.\n"
        "GMAIL_USER=\n"
        "GMAIL_APP_PASSWORD=",
        "Gmail SMTP block",
        "GMAIL_USER",
    )

    # ── docker-compose pass-throughs ──
    edit(
        ROOT / "docker-compose.yml",
        "      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}\n",
        "      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}\n"
        "      # -- Receipt Emails via Gmail SMTP (SMS-006) --\n"
        "      # Leave blank until the school's Gmail App Password is issued; the\n"
        "      # mailer stays disabled (skip-and-log) without both values.\n"
        "      GMAIL_USER: ${GMAIL_USER:-}\n"
        "      GMAIL_APP_PASSWORD: ${GMAIL_APP_PASSWORD:-}\n",
        "compose Gmail pass-throughs",
        "GMAIL_USER:",
    )

    # ── finance.service.ts: logger import + trigger (a) ──
    edit(
        BACKEND / "src/modules/finance/finance.service.ts",
        'import { FinanceRepository } from "./finance.repository";\n'
        'import type { ReceiptPdfData } from "@/lib/pdf";\n',
        'import { FinanceRepository } from "./finance.repository";\n'
        'import type { ReceiptPdfData } from "@/lib/pdf";\n'
        'import { logger } from "@/lib/logger";\n',
        "finance.service logger import",
        'from "@/lib/logger"',
    )
    edit(
        BACKEND / "src/modules/finance/finance.service.ts",
        "    // Existing manual collections keep their own transaction. Digital\n"
        "    // reconciliation will supply its own outer transaction.\n"
        "    return options.tx ? process(options.tx) : prisma.$transaction(process);\n"
        "  }\n",
        "    // Existing manual collections keep their own transaction. Digital\n"
        "    // reconciliation will supply its own outer transaction.\n"
        "    const committed = options.tx ? await process(options.tx) : await prisma.$transaction(process);\n"
        "\n"
        "    // SMS-006 trigger (a): manual cash collections dispatch the receipt\n"
        "    // email post-commit, asynchronously and fail-soft — a payment NEVER\n"
        "    // rolls back on mail failure. (Paystack settlements fire from the\n"
        "    // reconciliation service after its outer transaction commits.)\n"
        "    // Dynamic import avoids a module cycle: lib/receipt-email reuses\n"
        "    // FinanceService for the receipt DTO.\n"
        "    if (!options.tx) {\n"
        "      void import('@/lib/receipt-email')\n"
        "        .then((m) => m.sendCollectionReceipt(committed.id as string, 'CASH'))\n"
        "        .catch((err) => logger.warn({ err }, '[SMS-006] Receipt email dispatch hook failed (swallowed).'));\n"
        "    }\n"
        "\n"
        "    return committed;\n"
        "  }\n",
        "finance.service trigger (a)",
        "sendCollectionReceipt",
    )

    # ── payments.reconciliation.service.ts: trigger (b) ──
    edit(
        BACKEND / "src/modules/payments/payments.reconciliation.service.ts",
        "import { prisma } from '@/lib/prisma';\n",
        "import { prisma } from '@/lib/prisma';\n"
        "import { logger } from '@/lib/logger';\n",
        "reconciliation logger import",
        "@/lib/logger",
    )
    edit(
        BACKEND / "src/modules/payments/payments.reconciliation.service.ts",
        "export interface SettleResult {\n"
        "  settled: boolean;\n"
        "  alreadyReconciled: boolean;\n"
        "  status: PaymentIntentStatus;\n"
        "}\n",
        "export interface SettleResult {\n"
        "  settled: boolean;\n"
        "  alreadyReconciled: boolean;\n"
        "  status: PaymentIntentStatus;\n"
        "  /** SMS-006: PaymentCollection id for the post-commit receipt dispatch. */\n"
        "  collectionId?: string;\n"
        "}\n",
        "SettleResult.collectionId",
        "collectionId?:",
    )
    edit(
        BACKEND / "src/modules/payments/payments.reconciliation.service.ts",
        "    await this.finance.processInflowCollection(\n",
        "    const collection = await this.finance.processInflowCollection(\n",
        "capture settled collection",
        "const collection = await this.finance.processInflowCollection(",
    )
    edit(
        BACKEND / "src/modules/payments/payments.reconciliation.service.ts",
        "    return { settled: true, alreadyReconciled: false, status: PaymentIntentStatus.SUCCEEDED };\n",
        "    return {\n"
        "      settled: true,\n"
        "      alreadyReconciled: false,\n"
        "      status: PaymentIntentStatus.SUCCEEDED,\n"
        "      collectionId: collection.id as string,\n"
        "    };\n",
        "settle return collectionId",
        "collectionId: collection.id",
    )
    edit(
        BACKEND / "src/modules/payments/payments.reconciliation.service.ts",
        "      async (tx) => this.settleVerifiedTransaction(tx, reference, verified),\n"
        "      {\n"
        "        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,\n"
        "      },\n"
        "    );\n"
        "\n"
        "    return result;\n"
        "  }\n",
        "      async (tx) => this.settleVerifiedTransaction(tx, reference, verified),\n"
        "      {\n"
        "        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,\n"
        "      },\n"
        "    );\n"
        "\n"
        "    // SMS-006 trigger (b): the settlement has committed — dispatch the\n"
        "    // receipt email asynchronously and fail-soft (the payment stands\n"
        "    // regardless of the mail outcome). Skipped on idempotent no-op\n"
        "    // re-deliveries, which report settled=false.\n"
        "    if (result.settled && result.collectionId) {\n"
        "      const collectionId = result.collectionId;\n"
        "      void import('@/lib/receipt-email')\n"
        "        .then((m) => m.sendCollectionReceipt(collectionId, 'PAYSTACK'))\n"
        "        .catch((err) => logger.warn({ err }, '[SMS-006] Receipt email dispatch hook failed (swallowed).'));\n"
        "    }\n"
        "\n"
        "    return result;\n"
        "  }\n",
        "reconciliation post-commit hook",
        "sendCollectionReceipt(collectionId",
    )

    print()
    print("SMS-006 backend applied. Next: backend gates (lint/test/build), then docker rebuild + smoke.")


if __name__ == "__main__":
    main()
