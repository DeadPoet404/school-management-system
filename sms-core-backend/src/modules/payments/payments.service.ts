import { PaymentIntentStatus, PaymentProvider } from '@prisma/client';
import { AppError } from '@/middleware/error.handler';
import { prisma } from '@/lib/prisma';
import { createId } from '@paralleldrive/cuid2';
import { PaystackClient } from './paystack.client';
import { PaymentsReconciliationService } from './payments.reconciliation.service';
import { ROLES } from '@/middleware/rbac.middleware';
import { JwtPayload } from '@/types/auth.types';

export interface CreatePaymentIntentInput {
  studentId: string;
  payerEmail: string;
  amount: number;
  /** Optional channel restriction (e.g. ['mobile_money'] or ['bank_transfer']). */
  channels?: string[];
}

export interface CreateSelfPaymentIntentInput {
  payerEmail: string;
  amount: number;
}

type PayableStudent = {
  id: string;
  status: string;
  placement?: { classId: string | null } | null;
  billing?: { currentBalance?: unknown } | null;
};

const ACTIVE_INTENT_STATUSES: PaymentIntentStatus[] = [
  PaymentIntentStatus.PENDING,
  PaymentIntentStatus.INITIALIZED,
];

const CHECKOUT_CHANNELS = ['mobile_money', 'card', 'bank_transfer'];

export class PaymentsService {
  constructor(
    private readonly paystack = new PaystackClient(),
    private readonly reconciliation = new PaymentsReconciliationService(),
  ) {}

  async createPaystackIntent(input: CreatePaymentIntentInput, requestedBy: string) {
    const amount = this.assertConfiguredAndNormalize(input.amount);
    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      include: { placement: true, billing: true },
    });
    this.assertStudentEligible(student);
    this.assertAmountWithinBalance(student, amount);
    return this.createIntentForStudent(
      student,
      amount,
      input.payerEmail,
      requestedBy,
      input.channels,
    );
  }

  async createSelfPaystackIntent(
    studentId: string,
    input: CreateSelfPaymentIntentInput,
    requestedBy: string,
  ) {
    const amount = this.assertConfiguredAndNormalize(input.amount);
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { placement: true, billing: true },
    });
    this.assertStudentEligible(student);
    this.assertAmountWithinBalance(student, amount);

    const pending = await prisma.paymentIntent.findFirst({
      where: {
        studentId,
        status: { in: ACTIVE_INTENT_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (pending) {
      const sameAmount = Math.abs(Number(pending.amount) - amount) < 0.000001;
      if (sameAmount) {
        return { ...this.mapIntent(pending), resumed: true };
      }
      await prisma.paymentIntent.update({
        where: { id: pending.id },
        data: {
          status: PaymentIntentStatus.CANCELLED,
          failureReason: 'Replaced by a new self-service payment.',
        },
      });
    }

    return this.createIntentForStudent(student, amount, input.payerEmail, requestedBy);
  }

  async cancelIntent(reference: string, requester: JwtPayload) {
    const intent = await prisma.paymentIntent.findUnique({ where: { reference } });
    if (!intent) throw new AppError(404, 'Payment intent not found.');

    this.assertCanManageIntent(requester, intent.studentId);

    if (!ACTIVE_INTENT_STATUSES.includes(intent.status)) {
      return { id: intent.id, reference, status: intent.status, cancelled: false };
    }

    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: PaymentIntentStatus.CANCELLED,
        failureReason: 'Cancelled by user.',
      },
    });

    return {
      id: intent.id,
      reference,
      status: PaymentIntentStatus.CANCELLED,
      cancelled: true,
    };
  }

  async getIntentStatus(
    reference: string,
    requester: JwtPayload,
    opts: { verify?: boolean } = {},
  ) {
    const intent = await prisma.paymentIntent.findUnique({ where: { reference } });
    if (!intent) throw new AppError(404, 'Payment intent not found.');

    this.assertCanManageIntent(requester, intent.studentId);

    let verificationTriggered = false;
    if (
      opts.verify &&
      (intent.status === PaymentIntentStatus.PENDING ||
        intent.status === PaymentIntentStatus.INITIALIZED)
    ) {
      await this.reconciliation.verifyAndReconcileByReference(reference);
      verificationTriggered = true;
    }

    const latest = verificationTriggered
      ? await prisma.paymentIntent.findUnique({ where: { reference } })
      : intent;

    if (!latest) throw new AppError(404, 'Payment intent not found.');

    return {
      id: latest.id,
      reference: latest.reference,
      status: latest.status,
      amount: Number(latest.amount.toString()),
      currency: latest.currency,
      channel: latest.channel,
      paidAt: latest.paidAt,
      createdAt: latest.createdAt,
      verificationTriggered,
    };
  }

  async listIntents(
    opts: { studentId?: string; status?: string },
    requester: JwtPayload,
  ) {
    this.assertStaff(requester);

    const where: { studentId?: string; status?: PaymentIntentStatus } = {};
    if (opts.studentId) where.studentId = opts.studentId;
    if (opts.status) where.status = opts.status as PaymentIntentStatus;

    const intents = await prisma.paymentIntent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        student: { select: { studentId: true, studentName: true } },
      },
    });

    return intents.map((i) => ({
      id: i.id,
      reference: i.reference,
      status: i.status,
      amount: Number(i.amount.toString()),
      currency: i.currency,
      channel: i.channel,
      paidAt: i.paidAt,
      createdAt: i.createdAt,
      studentId: i.studentId,
      studentName: i.student?.studentName,
    }));
  }

  async reconcileIntentByReference(reference: string, requester: JwtPayload) {
    this.assertStaff(requester);

    const intent = await prisma.paymentIntent.findUnique({ where: { reference } });
    if (!intent) throw new AppError(404, 'Payment intent not found.');

    const result = await this.reconciliation.verifyAndReconcileByReference(reference);

    return { reference, ...result };
  }

  private assertStaff(requester: JwtPayload) {
    if (requester.role === ROLES.ADMIN || requester.role === ROLES.ACCOUNTANT) {
      return;
    }
    throw new AppError(403, 'You do not have permission to perform this action.');
  }

  /**
   * Self-service fee summary for the student portal (balance, invoices,
   * payment history, and any pending intent). Object-level authorization:
   * a STUDENT may only read their own summary; ADMIN/ACCOUNTANT may read any.
   */
  async getSelfFeesSummary(studentId: string, requester: JwtPayload) {
    this.assertCanViewStudentFees(requester, studentId);

    const [student, billing, invoices, payments, pendingIntent] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true, studentId: true, studentName: true },
      }),
      prisma.billingLedger.findUnique({ where: { studentId } }),
      prisma.invoice.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          invoiceNo: true,
          description: true,
          amount: true,
          dueDate: true,
          paidAmount: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.paymentCollection.findMany({
        where: { studentInternalId: studentId },
        orderBy: { dateProcessed: 'desc' },
        take: 50,
        select: {
          id: true,
          receiptNumber: true,
          amountPaid: true,
          paymentMethod: true,
          referenceNo: true,
          allocationTarget: true,
          dateProcessed: true,
        },
      }),
      prisma.paymentIntent.findFirst({
        where: {
          studentId,
          status: { in: ACTIVE_INTENT_STATUSES },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reference: true,
          status: true,
          amount: true,
          createdAt: true,
          authorizationUrl: true,
        },
      }),
    ]);

    if (!student) throw new AppError(404, 'Student not found.');

    return {
      student,
      balance: billing ? Number(billing.currentBalance.toString()) : 0,
      invoices: invoices.map((i) => ({
        id: i.id,
        invoiceNo: i.invoiceNo,
        description: i.description,
        amount: Number(i.amount.toString()),
        dueDate: i.dueDate,
        paidAmount: Number(i.paidAmount.toString()),
        status: i.status,
        createdAt: i.createdAt,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        receiptNumber: p.receiptNumber,
        amountPaid: Number(p.amountPaid.toString()),
        paymentMethod: p.paymentMethod,
        referenceNo: p.referenceNo,
        allocationTarget: p.allocationTarget,
        dateProcessed: p.dateProcessed,
      })),
      pendingIntent: pendingIntent
        ? {
            id: pendingIntent.id,
            reference: pendingIntent.reference,
            status: pendingIntent.status,
            amount: Number(pendingIntent.amount.toString()),
            createdAt: pendingIntent.createdAt,
            authorizationUrl: pendingIntent.authorizationUrl,
          }
        : null,
    };
  }

  private assertCanViewStudentFees(requester: JwtPayload, studentId: string) {
    if (requester.role === ROLES.STUDENT) {
      if (requester.entityType !== 'STUDENT' || requester.entityInternalId !== studentId) {
        throw new AppError(403, 'You can only view your own fees.');
      }
      return;
    }
    if (requester.role === ROLES.ADMIN || requester.role === ROLES.ACCOUNTANT) {
      return;
    }
    throw new AppError(403, 'You do not have permission to perform this action.');
  }

  // ───────────────────────── private helpers ─────────────────────────

  private assertConfiguredAndNormalize(amount: number): number {
    if (!this.paystack.isConfigured()) {
      throw new AppError(
        503,
        'Digital payments are not configured. Set PAYSTACK_SECRET_KEY to enable them.',
      );
    }
    const amountInSubunit = Math.round(amount * 100);
    if (Math.abs(amount * 100 - amountInSubunit) > 0.000001) {
      throw new AppError(400, 'Amount must have no more than two decimal places.');
    }
    return amountInSubunit / 100;
  }

  private assertStudentEligible(student: PayableStudent | null): asserts student is PayableStudent {
    if (!student || student.status !== 'ACTIVE') {
      throw new AppError(404, 'Active student not found.');
    }
    if (!student.placement?.classId) {
      throw new AppError(400, 'The student has no class placement for collection routing.');
    }
  }

  private assertAmountWithinBalance(student: PayableStudent, amount: number) {
    const currentBalance = Number(student.billing?.currentBalance?.toString() ?? '0');
    if (currentBalance <= 0) {
      throw new AppError(400, 'This student has no outstanding fee balance.');
    }
    if (amount > currentBalance + 0.000001) {
      throw new AppError(400, 'Payment amount cannot exceed the current outstanding balance.');
    }
  }

  private assertCanManageIntent(requester: JwtPayload, studentId: string) {
    if (requester.role === ROLES.STUDENT) {
      if (requester.entityType !== 'STUDENT' || requester.entityInternalId !== studentId) {
        throw new AppError(403, 'You can only manage your own payment intents.');
      }
      return;
    }
    if (requester.role === ROLES.ADMIN || requester.role === ROLES.ACCOUNTANT) {
      return;
    }
    throw new AppError(403, 'You do not have permission to perform this action.');
  }

  private async createIntentForStudent(
    student: PayableStudent,
    amount: number,
    payerEmail: string,
    requestedBy: string,
    channels: string[] = CHECKOUT_CHANNELS,
  ) {
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
          payerEmail,
          requestedBy,
          sectionId: student.placement!.classId,
        },
      },
    });

    try {
      const callbackUrl = process.env.PAYSTACK_CALLBACK_URL
        ? `${process.env.PAYSTACK_CALLBACK_URL}?reference=${reference}`
        : undefined;

      const initialized = await this.paystack.initializeTransaction({
        email: payerEmail,
        amountInSubunit: Math.round(amount * 100),
        currency: 'GHS',
        reference,
        channels,
        ...(callbackUrl ? { callbackUrl } : {}),
        metadata: {
          paymentIntentId: intent.id,
          studentId: student.id,
          reference,
        },
      });

      if (initialized.reference !== reference) {
        throw new AppError(502, 'Paystack returned a mismatched transaction reference.');
      }

      const updated = await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: PaymentIntentStatus.PENDING,
          authorizationUrl: initialized.authorizationUrl,
          accessCode: initialized.accessCode,
        },
      });

      return {
        ...this.mapIntent(updated),
        authorizationUrl: initialized.authorizationUrl,
        accessCode: initialized.accessCode,
      };
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : 'Paystack initialization failed.';
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

  private mapIntent(intent: {
    id: string;
    reference: string;
    status: PaymentIntentStatus;
    amount: unknown;
    currency: string;
    authorizationUrl?: string | null;
    accessCode?: string | null;
  }) {
    return {
      id: intent.id,
      reference: intent.reference,
      status: intent.status,
      amount: Number(intent.amount?.toString() ?? '0'),
      currency: intent.currency,
      authorizationUrl: intent.authorizationUrl ?? undefined,
      accessCode: intent.accessCode ?? undefined,
    };
  }
}
