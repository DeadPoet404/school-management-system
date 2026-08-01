import { Prisma, PaymentProvider } from '@prisma/client';
import { createHash } from 'crypto';
import { AppError } from '@/middleware/error.handler';
import { prisma } from '@/lib/prisma';
import { PaystackClient } from './paystack.client';
import { PaymentsReconciliationService } from './payments.reconciliation.service';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export class PaymentsWebhookService {
  constructor(
    private readonly paystack = new PaystackClient(),
    private readonly reconciliation = new PaymentsReconciliationService(),
  ) {}

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

    if (!isRecord(event) || !isRecord(event.data)) {
      throw new AppError(400, 'Invalid Paystack webhook event shape.');
    }

    const eventType = asNonEmptyString(event.event);
    if (!eventType) {
      throw new AppError(400, 'Invalid Paystack webhook event shape.');
    }

    // Acknowledge Paystack events that are outside the collection workflow.
    if (eventType !== 'charge.success') {
      return { duplicate: false, ignored: true };
    }

    const reference = asNonEmptyString(event.data.reference);
    if (!reference) {
      throw new AppError(400, 'Paystack charge.success event has no reference.');
    }

    const intent = await prisma.paymentIntent.findUnique({
      where: { reference },
      select: { provider: true },
    });

    // Ignore a valid Paystack event that belongs to another product/workflow.
    if (!intent || intent.provider !== PaymentProvider.PAYSTACK) {
      return { duplicate: false, ignored: true };
    }

    const transactionId = asNonEmptyString(event.data.id);
    const eventKey = transactionId
      ? `${eventType}:${transactionId}`
      : `${eventType}:${createHash('sha256').update(rawBody).digest('hex')}`;

    let webhookEventId: string;
    let duplicate = false;

    try {
      const webhookEvent = await prisma.paymentWebhookEvent.create({
        data: {
          provider: PaymentProvider.PAYSTACK,
          eventType,
          eventKey,
          payload: event as Prisma.InputJsonValue,
        },
      });

      webhookEventId = webhookEvent.id;
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }

      const existingEvent = await prisma.paymentWebhookEvent.findUnique({
        where: {
          provider_eventKey: {
            provider: PaymentProvider.PAYSTACK,
            eventKey,
          },
        },
        select: { id: true },
      });

      if (!existingEvent) {
        throw error;
      }

      webhookEventId = existingEvent.id;
      duplicate = true;
    }

    // New and duplicate webhooks both enter reconciliation. A processed event
    // is an idempotent no-op; a previously failed event is retried safely.
    const reconciliation = await this.reconciliation.reconcileWebhookEvent(
      webhookEventId,
    );

    return {
      duplicate,
      ignored: false,
      ...reconciliation,
    };
  }
}
