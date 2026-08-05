/**
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
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
    .join('\n');
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
