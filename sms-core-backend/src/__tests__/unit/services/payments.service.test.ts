/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentIntentStatus } from '@prisma/client';

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    paymentIntent: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    paymentWebhookEvent: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    student: { findUnique: vi.fn() },
    billingLedger: { findUnique: vi.fn() },
    invoice: { findMany: vi.fn() },
    paymentCollection: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { prismaMock };
});

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/modules/payments/paystack.client', () => ({
  PaystackClient: class {
    isConfigured = vi.fn(() => true);
    initializeTransaction = vi.fn();
  },
}));
vi.mock('@/modules/payments/payments.reconciliation.service', () => ({
  PaymentsReconciliationService: class {
    verifyAndReconcileByReference = vi.fn();
  },
}));
vi.mock('@paralleldrive/cuid2', () => ({ createId: () => 'fixedref' }));

import { PaymentsService } from '@/modules/payments/payments.service';
import { PaystackClient } from '@/modules/payments/paystack.client';
import { PaymentsReconciliationService } from '@/modules/payments/payments.reconciliation.service';

const paystack = new PaystackClient() as any;
const reconciliation = new PaymentsReconciliationService() as any;
const service = new PaymentsService(paystack, reconciliation);

function student(overrides: Record<string, any> = {}) {
  return {
    id: 'stu-1',
    status: 'ACTIVE',
    placement: { classId: 'class-1' },
    billing: { currentBalance: 5000 },
    ...overrides,
  };
}

function createdIntent(overrides: Record<string, any> = {}) {
  return {
    id: 'intent-1',
    reference: 'SMS-fixedref',
    status: PaymentIntentStatus.INITIALIZED,
    amount: 5000,
    currency: 'GHS',
    ...overrides,
  };
}

const staffAdmin = {
  sub: 'acc-1',
  email: 'a@school',
  role: 'ADMIN',
  entityType: 'STAFF' as const,
  entityInternalId: 'staff-1',
};
const studentUser = {
  sub: 'acc-2',
  email: 'stu@s',
  role: 'STUDENT',
  entityType: 'STUDENT' as const,
  entityInternalId: 'stu-1',
};
const otherStudentUser = {
  ...studentUser,
  entityInternalId: 'stu-OTHER',
};

beforeEach(() => {
  vi.clearAllMocks();
  (paystack.isConfigured as any).mockReturnValue(true);
  (prismaMock.student.findUnique as any).mockResolvedValue(student());
  (prismaMock.paymentIntent.create as any).mockResolvedValue(createdIntent());
  (prismaMock.paymentIntent.update as any).mockResolvedValue(
    createdIntent({ status: PaymentIntentStatus.PENDING }),
  );
  (prismaMock.paymentIntent.findFirst as any).mockResolvedValue(null);
  (prismaMock.paymentIntent.findUnique as any).mockResolvedValue(
    createdIntent({ status: PaymentIntentStatus.PENDING }),
  );
  (paystack.initializeTransaction as any).mockResolvedValue({
    reference: 'SMS-fixedref',
    authorizationUrl: 'https://paystack.co/u',
    accessCode: 'ac',
  });
});

describe('createSelfPaystackIntent', () => {
  it('creates a checkout for a valid student', async () => {
    const result = await service.createSelfPaystackIntent('stu-1', {
      payerEmail: 'parent@x.com',
      amount: 2000,
    }, 'a@school');
    expect(result.authorizationUrl).toBe('https://paystack.co/u');
    expect(prismaMock.paymentIntent.create).toHaveBeenCalledTimes(1);
  });

  it('throws 503 when Paystack is not configured', async () => {
    (paystack.isConfigured as any).mockReturnValue(false);
    await expect(
      service.createSelfPaystackIntent('stu-1', { payerEmail: 'p@x.com', amount: 100 }, 'a'),
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  it('throws 400 for more than two decimal places', async () => {
    await expect(
      service.createSelfPaystackIntent('stu-1', { payerEmail: 'p@x.com', amount: 12.345 }, 'a'),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('two decimal places') });
  });

  it('throws 404 for a missing or inactive student', async () => {
    (prismaMock.student.findUnique as any).mockResolvedValue(null);
    await expect(
      service.createSelfPaystackIntent('stu-1', { payerEmail: 'p@x.com', amount: 100 }, 'a'),
    ).rejects.toMatchObject({ statusCode: 404 });
    (prismaMock.student.findUnique as any).mockResolvedValue(student({ status: 'GRADUATED' }));
    await expect(
      service.createSelfPaystackIntent('stu-1', { payerEmail: 'p@x.com', amount: 100 }, 'a'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 if the student has no class placement', async () => {
    (prismaMock.student.findUnique as any).mockResolvedValue(student({ placement: null }));
    await expect(
      service.createSelfPaystackIntent('stu-1', { payerEmail: 'p@x.com', amount: 100 }, 'a'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 if there is no outstanding balance', async () => {
    (prismaMock.student.findUnique as any).mockResolvedValue(
      student({ billing: { currentBalance: 0 } }),
    );
    await expect(
      service.createSelfPaystackIntent('stu-1', { payerEmail: 'p@x.com', amount: 100 }, 'a'),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('no outstanding') });
  });

  it('throws 400 if the amount exceeds the balance', async () => {
    await expect(
      service.createSelfPaystackIntent('stu-1', { payerEmail: 'p@x.com', amount: 6000 }, 'a'),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('cannot exceed') });
  });

  it('resumes the existing checkout when same amount is pending', async () => {
    (prismaMock.paymentIntent.findFirst as any).mockResolvedValue(
      createdIntent({ status: PaymentIntentStatus.PENDING }),
    );
    const result: any = await service.createSelfPaystackIntent('stu-1', {
      payerEmail: 'p@x.com',
      amount: 5000,
    }, 'a');
    expect(result.resumed).toBe(true);
    expect(prismaMock.paymentIntent.create).not.toHaveBeenCalled();
  });

  it('cancels the old intent and creates a new one when amount differs', async () => {
    (prismaMock.paymentIntent.findFirst as any).mockResolvedValue(
      createdIntent({ status: PaymentIntentStatus.PENDING }),
    );
    const result: any = await service.createSelfPaystackIntent('stu-1', {
      payerEmail: 'p@x.com',
      amount: 3000,
    }, 'a');
    expect(prismaMock.paymentIntent.create).toHaveBeenCalledTimes(1);
    expect((prismaMock.paymentIntent.update as any).mock.calls[0][0].data.status).toBe(
      PaymentIntentStatus.CANCELLED,
    );
    expect(result.resumed).toBeUndefined();
  });
});

describe('cancelIntent authorization', () => {
  it('allows a student to cancel their own intent', async () => {
    (prismaMock.paymentIntent.findUnique as any).mockResolvedValue(
      createdIntent({ status: PaymentIntentStatus.PENDING, studentId: 'stu-1' }),
    );
    const result = await service.cancelIntent('SMS-fixedref', studentUser);
    expect(result.cancelled).toBe(true);
  });

  it("blocks a student from cancelling another student's intent (403)", async () => {
    (prismaMock.paymentIntent.findUnique as any).mockResolvedValue(
      createdIntent({ status: PaymentIntentStatus.PENDING, studentId: 'stu-1' }),
    );
    await expect(service.cancelIntent('SMS-fixedref', otherStudentUser)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('getIntentStatus authorization', () => {
  it("blocks a student from reading another student's intent (403)", async () => {
    (prismaMock.paymentIntent.findUnique as any).mockResolvedValue(
      createdIntent({ status: PaymentIntentStatus.PENDING, studentId: 'stu-1' }),
    );
    await expect(
      service.getIntentStatus('SMS-fixedref', otherStudentUser),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows staff to read any intent and triggers verify on demand', async () => {
    (prismaMock.paymentIntent.findUnique as any)
      .mockResolvedValueOnce(createdIntent({ status: PaymentIntentStatus.PENDING, studentId: 'stu-1' }))
      .mockResolvedValueOnce(createdIntent({ status: PaymentIntentStatus.SUCCEEDED, studentId: 'stu-1' }));
    (reconciliation.verifyAndReconcileByReference as any).mockResolvedValue({});
    const result = await service.getIntentStatus('SMS-fixedref', staffAdmin, { verify: true });
    expect(reconciliation.verifyAndReconcileByReference).toHaveBeenCalledWith('SMS-fixedref');
    expect(result.verificationTriggered).toBe(true);
  });
});

describe('staff-only endpoints', () => {
  it('blocks listIntents for a student (403)', async () => {
    await expect(service.listIntents({}, studentUser)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('blocks reconcileIntentByReference for a student (403)', async () => {
    await expect(
      service.reconcileIntentByReference('SMS-fixedref', studentUser),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows ADMIN to reconcile an existing intent', async () => {
    (prismaMock.paymentIntent.findUnique as any).mockResolvedValue(
      createdIntent({ status: PaymentIntentStatus.PENDING, studentId: 'stu-1' }),
    );
    (reconciliation.verifyAndReconcileByReference as any).mockResolvedValue({ settled: true });
    const result = await service.reconcileIntentByReference('SMS-fixedref', staffAdmin);
    expect(reconciliation.verifyAndReconcileByReference).toHaveBeenCalledWith('SMS-fixedref');
    expect(result).toEqual({ reference: 'SMS-fixedref', settled: true });
  });
});


describe('getSelfFeesSummary', () => {
  const studentUserSelf = studentUser;
  const otherStudent = { ...studentUser, entityInternalId: 'stu-OTHER' };

  beforeEach(() => {
    (prismaMock.billingLedger.findUnique as any).mockResolvedValue({ currentBalance: 4000 });
    (prismaMock.student.findUnique as any).mockResolvedValue({
      id: 'stu-1', studentId: 'S001', studentName: 'Ama',
    });
    (prismaMock.invoice.findMany as any).mockResolvedValue([
      { id: 'inv1', invoiceNo: 'INV-1', description: 'Fees', amount: 5000, dueDate: new Date(), paidAmount: 1000, status: 'PARTIAL', createdAt: new Date() },
    ]);
    (prismaMock.paymentCollection.findMany as any).mockResolvedValue([
      { id: 'pc1', receiptNumber: 'REC-1', amountPaid: 1000, paymentMethod: 'PAYSTACK - Card', referenceNo: 'SMS-x', allocationTarget: 'Fees', dateProcessed: new Date() },
    ]);
    (prismaMock.paymentIntent.findFirst as any).mockResolvedValue(null);
  });

  it("blocks a student from reading another student's summary (403)", async () => {
    await expect(service.getSelfFeesSummary('stu-1', otherStudent)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("returns the authenticated student's own summary", async () => {
    const result = await service.getSelfFeesSummary('stu-1', studentUserSelf);
    expect(result.student.studentName).toBe('Ama');
    expect(result.balance).toBe(4000);
    expect(result.invoices).toHaveLength(1);
    expect(result.payments).toHaveLength(1);
    expect(result.pendingIntent).toBeNull();
  });
});
