import { PaymentIntentStatus, Prisma } from '@prisma/client';
import { AppError } from '@/middleware/error.handler';
import { prisma } from '@/lib/prisma';
import { FinanceService } from '@/modules/finance/finance.service';
import { PaystackClient, VerifiedPaystackTransaction } from './paystack.client';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getReference(payload: unknown): string {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new AppError(400, 'Stored Paystack webhook payload is invalid.');
  }

  const reference = payload.data.reference;
  if (typeof reference !== 'string' || reference.trim() === '') {
    throw new AppError(400, 'Stored Paystack webhook has no transaction reference.');
  }

  return reference;
}

/**
 * A webhook is evidence, not settlement authority by itself.
 *
 * This service independently verifies the transaction with Paystack, then
 * performs intent status transition plus all internal accounting operations in
 * one serializable PostgreSQL transaction.
 */
export class PaymentsReconciliationService {
  constructor(
    private readonly paystack = new PaystackClient(),
    private readonly finance = new FinanceService(),
  ) {}

  async reconcileWebhookEvent(webhookEventId: string) {
    const webhookEvent = await prisma.paymentWebhookEvent.findUnique({
      where: { id: webhookEventId },
    });

    if (!webhookEvent) {
      throw new AppError(404, 'Payment webhook event not found.');
    }

    if (webhookEvent.processedAt) {
      return { alreadyReconciled: true };
    }

    try {
      const reference = getReference(webhookEvent.payload);

      // Independent server-to-server verification: never trust only a webhook.
      const verified = await this.paystack.verifyTransaction(reference);
      this.assertVerified(reference, verified);

      const result = await prisma.$transaction(
        async (tx) => {
          const intent = await tx.paymentIntent.findUnique({
            where: { reference },
            include: {
              student: {
                include: { placement: true },
              },
            },
          });

          if (!intent) {
            throw new AppError(404, 'Payment intent not found for verified transaction.');
          }

          const providerTransactionId = String(verified.id);

          // Idempotency: once settled, the same transaction is a no-op.
          if (intent.status === PaymentIntentStatus.SUCCEEDED) {
            if (intent.providerTransactionId !== providerTransactionId) {
              throw new AppError(
                409,
                'Payment intent was already settled by a different transaction.',
              );
            }

            return { alreadyReconciled: true };
          }

          if (
            intent.status !== PaymentIntentStatus.PENDING &&
            intent.status !== PaymentIntentStatus.INITIALIZED
          ) {
            throw new AppError(
              409,
              `Payment intent cannot be settled from ${intent.status} status.`,
            );
          }

          const expectedSubunit = Math.round(Number(intent.amount.toString()) * 100);

          if (verified.amount !== expectedSubunit) {
            throw new AppError(
              409,
              'Verified Paystack amount does not match the payment intent.',
            );
          }

          if (verified.currency !== intent.currency || verified.currency !== 'GHS') {
            throw new AppError(
              409,
              'Verified Paystack currency does not match the payment intent.',
            );
          }

          if (!intent.student.placement?.classId) {
            throw new AppError(
              400,
              'Student class placement is required for collection routing.',
            );
          }

          // This transition and all financial records commit together or roll
          // back together. A retry can safely happen after any failure.
          await tx.paymentIntent.update({
            where: { id: intent.id },
            data: {
              status: PaymentIntentStatus.SUCCEEDED,
              providerTransactionId,
              channel: verified.channel ?? null,
              paidAt: verified.paidAt ? new Date(verified.paidAt) : new Date(),
              failureReason: null,
            },
          });

          await this.finance.processInflowCollection(
            {
              sectionId: intent.student.placement.classId,
              studentName: intent.student.studentName,
              amountPaid: Number(intent.amount.toString()),
              paymentMethod: 'PAYSTACK',
              referenceNo: reference,
              allocationTarget: 'Digital fee payment',
              studentInternalId: intent.studentId,
            },
            {
              tx,
              paymentIntentId: intent.id,
            },
          );

          return { alreadyReconciled: false };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      await prisma.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processedAt: new Date(),
          processingError: null,
        },
      });

      return result;
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Payment reconciliation failed.';

      await prisma.paymentWebhookEvent
        .update({
          where: { id: webhookEvent.id },
          data: {
            processingError: reason.slice(0, 2000),
          },
        })
        .catch(() => undefined);

      throw error;
    }
  }

  private assertVerified(reference: string, transaction: VerifiedPaystackTransaction) {
    if (transaction.reference !== reference) {
      throw new AppError(409, 'Paystack verification returned a mismatched reference.');
    }

    if (transaction.status !== 'success') {
      throw new AppError(409, 'Paystack transaction is not successful.');
    }

    if (transaction.currency !== 'GHS') {
      throw new AppError(409, 'Paystack transaction currency must be GHS.');
    }
  }
}
