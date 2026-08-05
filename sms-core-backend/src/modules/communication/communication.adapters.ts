/**
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
      html: `<p>${escapeHtml(input.text).replace(/\n/g, '<br>')}</p>`,
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
