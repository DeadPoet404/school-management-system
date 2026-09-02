/**
 * SMS-013 — temporary credential delivery.
 *
 * Replaces the Phase-4 TODO in teacher.controller.ts: onboarding used to
 * return the plaintext temporary password in the HTTP response body, where
 * it landed in proxy logs, browser history, and the admin's network tab.
 *
 * Contract (mirrors lib/receipt-email.ts): fail-soft. dispatch() NEVER
 * throws. It resolves a DeliveryOutcome so the caller can tell the admin
 * whether to fall back to a manual, out-of-band handover.
 */
import { logger } from '@/lib/logger';
import { isMailerConfigured, sendMail } from '@/lib/mailer';

export type DeliveryStatus = 'SENT' | 'UNCONFIGURED' | 'FAILED';

export interface DeliveryOutcome {
  status: DeliveryStatus;
  /** Safe for the admin UI. Never contains the credential itself. */
  message: string;
}

export interface CredentialDispatch {
  to: string;
  recipientName: string;
  temporaryPassword: string;
  loginUrl?: string;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildText(d: CredentialDispatch, loginUrl: string): string {
  return [
    'JOCOMFY SCHOOL — STAFF PORTAL ACCESS',
    '',
    `Dear ${d.recipientName},`,
    '',
    'A staff portal account has been created for you. Sign in with the',
    'temporary password below and change it immediately.',
    '',
    `  Portal:   ${loginUrl}`,
    `  Email:    ${d.to}`,
    `  Password: ${d.temporaryPassword}`,
    '',
    'This password is temporary. Do not share it with anyone, and do not',
    'reply to this message with your new password. If you did not expect',
    'this email, contact the school administrator immediately.',
    '',
    '— School Management System (automated message)',
  ].join('\n');
}

function buildHtml(d: CredentialDispatch, loginUrl: string): string {
  return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#111">
  <h2 style="color:#001f54;margin-bottom:4px">Staff Portal Access</h2>
  <p>Dear ${esc(d.recipientName)},</p>
  <p>A staff portal account has been created for you. Sign in with the temporary
     password below and <strong>change it immediately</strong>.</p>
  <table cellpadding="8" style="border-collapse:collapse;background:#f6f7f9;border-left:4px solid #001f54">
    <tr><td><strong>Portal</strong></td><td><a href="${esc(loginUrl)}">${esc(loginUrl)}</a></td></tr>
    <tr><td><strong>Email</strong></td><td>${esc(d.to)}</td></tr>
    <tr><td><strong>Password</strong></td><td><code style="font-size:15px">${esc(d.temporaryPassword)}</code></td></tr>
  </table>
  <p style="font-size:13px;color:#555">This password is temporary. Do not share it, and never reply to this
     message with your new password. If you did not expect this email, contact the school administrator.</p>
  <hr style="border:none;border-top:1px solid #ddd">
  <p style="font-size:12px;color:#888">School Management System — automated message.</p>
</body></html>`;
}

/**
 * Deliver a temporary credential out-of-band. Resolves rather than rejects
 * so a mail outage can never roll back a committed onboarding transaction.
 */
export async function dispatchTemporaryCredential(
  d: CredentialDispatch,
): Promise<DeliveryOutcome> {
  const loginUrl = d.loginUrl ?? process.env.STAFF_PORTAL_URL ?? 'https://sms.jocomfy.com';

  if (!isMailerConfigured()) {
    logger.warn(
      { recipient: d.to },
      '[credential-email] mailer unconfigured — credential NOT delivered; manual handover required.',
    );
    return {
      status: 'UNCONFIGURED',
      message:
        'Email delivery is not configured. Issue this account\'s temporary password through the manual handover procedure.',
    };
  }

  try {
    const result = await sendMail({
      to: d.to,
      subject: 'Your staff portal access',
      text: buildText(d, loginUrl),
      html: buildHtml(d, loginUrl),
    });

    if (!result.sent) {
      logger.error(
        { recipient: d.to, reason: result.reason },
        '[credential-email] delivery failed — manual handover required.',
      );
      return {
        status: 'FAILED',
        message:
          'Account created, but the credential email could not be delivered. Use the manual handover procedure.',
      };
    }

    logger.info({ recipient: d.to }, '[credential-email] temporary credential delivered.');
    return { status: 'SENT', message: `Temporary password emailed to ${d.to}.` };
  } catch (error) {
    logger.error(
      { recipient: d.to, err: (error as Error).message },
      '[credential-email] unexpected delivery error.',
    );
    return {
      status: 'FAILED',
      message:
        'Account created, but the credential email could not be delivered. Use the manual handover procedure.',
    };
  }
}
