import { Prisma, PaymentProvider } from '@prisma/client';
import { createHash } from 'crypto';
import { AppError } from '@/middleware/error.handler';
import { prisma } from '@/lib/prisma';
import { PaystackClient } from './paystack.client';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Receives provider evidence but deliberately does not settle a payment yet.
 * Reconciliation in the next step will verify the transaction against
 * Paystack's REST API before internal financial records are changed.
 */
export class PaymentsWebhookService {
  constructor(private readonly paystack = new PaystackClient()) {}

  async recordPaystackEvent(rawBody: Buffer, signature: unknown) {
    if (!this.paystack.isConfigured()) {
      throw new AppError(503, 'Digital payments are not configured.');
    }

    if (!this.paystack.verifyWebhookSignature(rawBody, signature)) {
      throw new AppError(400, 'Invalid Paystack webhook signature.');
    }

    let event: unknown;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new AppError(400, 'Invalid Paystack webhook payload.');
    }

    if (!isRecord(event)) {
      throw new AppError(400, 'Invalid Paystack webhook payload.');
    }

    const eventType = asNonEmptyString(event.event);
    const data = event.data;
    if (!eventType || !isRecord(data)) {
      throw new AppError(400, 'Invalid Paystack webhook event shape.');
    }

    // Other Paystack events may be sent to the configured endpoint. They are
    // acknowledged so Paystack does not retry them, but are not persisted.
    if (eventType !== 'charge.success') {
      return { duplicate: false, ignored: true };
    }

    const reference = asNonEmptyString(data.reference);
    if (!reference) {
      throw new AppError(400, 'Paystack charge.success event has no reference.');
    }

    // Ignore transactions that do not belong to this application rather than
    // creating arbitrary provider data in the school database.
    const intent = await prisma.paymentIntent.findUnique({
      where: { reference },
      select: { id: true, provider: true },
    });
    if (!intent || intent.provider !== PaymentProvider.PAYSTACK) {
      return { duplicate: false, ignored: true };
    }

    const transactionId = asNonEmptyString(data.id);
    const eventKey = transactionId
      ? `${eventType}:${transactionId}`
      : `${eventType}:${createHash('sha256').update(rawBody).digest('hex')}`;

    try {
      await prisma.paymentWebhookEvent.create({
        data: {
          provider: PaymentProvider.PAYSTACK,
          eventType,
          eventKey,
          payload: event as Prisma.InputJsonValue,
        },
      });
      return { duplicate: false, ignored: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { duplicate: true, ignored: false };
      }
      throw error;
    }
  }
}
