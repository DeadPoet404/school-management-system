import { PaymentIntentStatus, PaymentProvider } from '@prisma/client';
import { AppError } from '@/middleware/error.handler';
import { prisma } from '@/lib/prisma';
import { createId } from '@paralleldrive/cuid2';
import { PaystackClient } from './paystack.client';

export interface CreatePaymentIntentInput {
  studentId: string;
  payerEmail: string;
  amount: number;
}

/**
 * Application service for starting a digital collection.
 *
 * No money is recorded here. The intent remains PENDING until a verified
 * Paystack callback is reconciled in a later step.
 */
export class PaymentsService {
  constructor(private readonly paystack = new PaystackClient()) {}

  async createPaystackIntent(input: CreatePaymentIntentInput, requestedBy: string) {
    if (!this.paystack.isConfigured()) {
      throw new AppError(
        503,
        'Digital payments are not configured. Set PAYSTACK_SECRET_KEY to enable them.',
      );
    }

    const amountInSubunit = Math.round(input.amount * 100);
    if (Math.abs(input.amount * 100 - amountInSubunit) > 0.000001) {
      throw new AppError(400, 'Amount must have no more than two decimal places.');
    }

    const amount = amountInSubunit / 100;
    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      include: { placement: true, billing: true },
    });

    if (!student || student.status !== 'ACTIVE') {
      throw new AppError(404, 'Active student not found.');
    }

    if (!student.placement?.classId) {
      throw new AppError(400, 'The student has no class placement for collection routing.');
    }

    const currentBalance = Number(student.billing?.currentBalance?.toString() ?? '0');
    if (currentBalance <= 0) {
      throw new AppError(400, 'This student has no outstanding fee balance.');
    }

    if (amount > currentBalance + 0.000001) {
      throw new AppError(400, 'Payment amount cannot exceed the current outstanding balance.');
    }

    // Paystack references allow alphanumerics and hyphens. It is generated
    // server-side and is the correlation key for initialization and callback.
    const reference = `SMS-${createId()}`;
    const intent = await prisma.paymentIntent.create({
      data: {
        provider: PaymentProvider.PAYSTACK,
        status: PaymentIntentStatus.INITIALIZED,
        studentId: student.id,
        amount,
        currency: 'GHS',
        reference,
        metadata: {
          payerEmail: input.payerEmail,
          requestedBy,
          sectionId: student.placement.classId,
        },
      },
    });

    try {
      const initialized = await this.paystack.initializeTransaction({
        email: input.payerEmail,
        amountInSubunit,
        currency: 'GHS',
        reference,
        channels: ['mobile_money', 'card'],
        metadata: {
          paymentIntentId: intent.id,
          studentId: student.id,
          reference,
        },
      });

      if (initialized.reference !== reference) {
        throw new AppError(502, 'Paystack returned a mismatched transaction reference.');
      }

      const updatedIntent = await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: PaymentIntentStatus.PENDING,
          authorizationUrl: initialized.authorizationUrl,
          accessCode: initialized.accessCode,
        },
      });

      return {
        id: updatedIntent.id,
        reference: updatedIntent.reference,
        status: updatedIntent.status,
        amount: Number(updatedIntent.amount.toString()),
        currency: updatedIntent.currency,
        authorizationUrl: initialized.authorizationUrl,
        accessCode: initialized.accessCode,
      };
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : 'Paystack initialization failed.';

      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: PaymentIntentStatus.FAILED,
          failureReason: failureReason.slice(0, 2000),
        },
      });

      throw error;
    }
  }
}
