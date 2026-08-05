/**
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
