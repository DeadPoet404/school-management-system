import { createHmac, timingSafeEqual } from 'crypto';
import { AppError } from '@/middleware/error.handler';

const DEFAULT_PAYSTACK_API_BASE_URL = 'https://api.paystack.co';

type JsonRecord = Record<string, unknown>;

export interface InitializePaystackTransactionInput {
  email: string;
  amountInSubunit: number;
  currency: 'GHS';
  reference: string;
  metadata: JsonRecord;
  callbackUrl?: string;
  channels?: string[];
}

export interface InitializedPaystackTransaction {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifiedPaystackTransaction {
  id: number;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  channel?: string;
  paidAt?: string;
}

interface PaystackApiResponse {
  status: boolean;
  message?: string;
  data?: JsonRecord;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

/**
 * The only component allowed to call Paystack's REST API.
 *
 * This is deliberately provider-specific but isolated. A future Hubtel or
 * MTN-MoMo adapter can implement the same application-facing contract without
 * contaminating finance reconciliation code with gateway details.
 */
export class PaystackClient {
  private readonly secretKey: string;
  private readonly baseUrl: string;

  constructor(
    secretKey = process.env.PAYSTACK_SECRET_KEY ?? '',
    baseUrl = process.env.PAYSTACK_API_BASE_URL ?? DEFAULT_PAYSTACK_API_BASE_URL,
  ) {
    this.secretKey = secretKey.trim();
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return this.secretKey.length > 0;
  }

  async initializeTransaction(
    input: InitializePaystackTransactionInput,
  ): Promise<InitializedPaystackTransaction> {
    const response = await this.request('/transaction/initialize', {
      method: 'POST',
      body: {
        email: input.email,
        amount: String(input.amountInSubunit),
        currency: input.currency,
        reference: input.reference,
        metadata: JSON.stringify(input.metadata),
        ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
        ...(input.channels?.length ? { channels: input.channels } : {}),
      },
    });

    const authorizationUrl = asNonEmptyString(response.data?.authorization_url);
    const accessCode = asNonEmptyString(response.data?.access_code);
    const reference = asNonEmptyString(response.data?.reference);

    if (!authorizationUrl || !accessCode || !reference) {
      throw new AppError(
        502,
        'Paystack returned an incomplete transaction initialization response.',
      );
    }

    return { authorizationUrl, accessCode, reference };
  }

  async verifyTransaction(reference: string): Promise<VerifiedPaystackTransaction> {
    const response = await this.request(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      { method: 'GET' },
    );

    const id = asFiniteNumber(response.data?.id);
    const verifiedReference = asNonEmptyString(response.data?.reference);
    const status = asNonEmptyString(response.data?.status);
    const amount = asFiniteNumber(response.data?.amount);
    const currency = asNonEmptyString(response.data?.currency);

    if (
      id === null ||
      !verifiedReference ||
      !status ||
      amount === null ||
      !currency
    ) {
      throw new AppError(
        502,
        'Paystack returned an incomplete transaction verification response.',
      );
    }

    const channel = asNonEmptyString(response.data?.channel) ?? undefined;
    const paidAt = asNonEmptyString(response.data?.paid_at) ?? undefined;

    return {
      id,
      reference: verifiedReference,
      status,
      amount,
      currency,
      ...(channel ? { channel } : {}),
      ...(paidAt ? { paidAt } : {}),
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: unknown): boolean {
    if (!this.isConfigured() || typeof signature !== 'string') {
      return false;
    }

    const normalizedSignature = signature.trim();
    if (!/^[a-fA-F0-9]{128}$/.test(normalizedSignature)) {
      return false;
    }

    const expected = createHmac('sha512', this.secretKey).update(rawBody).digest();
    const supplied = Buffer.from(normalizedSignature, 'hex');

    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  private async request(
    path: string,
    options: { method: 'GET' | 'POST'; body?: JsonRecord },
  ): Promise<PaystackApiResponse> {
    if (!this.isConfigured()) {
      throw new AppError(
        503,
        'Digital payments are not configured. Set PAYSTACK_SECRET_KEY to enable them.',
      );
    }

    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new AppError(
        502,
        'Unable to reach Paystack. Please try again later.',
      );
    }

    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      // Handled below as an invalid upstream response.
    }

    if (!isRecord(payload) || typeof payload.status !== 'boolean') {
      throw new AppError(
        502,
        'Paystack returned an invalid response.',
      );
    }

    const parsed: PaystackApiResponse = {
      status: payload.status,
      ...(typeof payload.message === 'string' ? { message: payload.message } : {}),
      ...(isRecord(payload.data) ? { data: payload.data } : {}),
    };

    if (!response.ok || !parsed.status) {
      throw new AppError(
        502,
        parsed.message || 'Paystack rejected the payment request.',
      );
    }

    return parsed;
  }
}
