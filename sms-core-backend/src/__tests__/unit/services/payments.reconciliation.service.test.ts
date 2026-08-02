/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentIntentStatus } from '@prisma/client';

const { tx, prismaMock } = vi.hoisted(() => {
  const tx = {
    paymentIntent: { findUnique: vi.fn(), update: vi.fn() },
  };
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
    $transaction: vi.fn((cb: any) => cb(tx)),
  };
  return { tx, prismaMock };
});

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/modules/finance/finance.service', () => ({
  FinanceService: class {
    processInflowCollection = vi.fn();
  },
}));
vi.mock('@/modules/payments/paystack.client', () => ({
  PaystackClient: class {
    verifyTransaction = vi.fn();
  },
}));

import { PaymentsReconciliationService } from '@/modules/payments/payments.reconciliation.service';
import { PaystackClient } from '@/modules/payments/paystack.client';
import { FinanceService } from '@/modules/finance/finance.service';

const paystack = new PaystackClient() as any;
const finance = new FinanceService() as any;
const service = new PaymentsReconciliationService(paystack, finance);

function intent(overrides: Record<string, any> = {}) {
  return {
    id: 'intent-1',
    reference: 'SMS-123',
    status: PaymentIntentStatus.PENDING,
    amount: 5000,
    currency: 'GHS',
    providerTransactionId: null,
    studentId: 'stu-1',
    student: {
      studentName: 'Ama',
      studentId: 'S001',
      placement: { classId: 'class-1' },
    },
    ...overrides,
  };
}

function verified(overrides: Record<string, any> = {}) {
  return {
    id: 777,
    reference: 'SMS-123',
    status: 'success',
    amount: 500000,
    currency: 'GHS',
    channel: 'card',
    paidAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (finance.processInflowCollection as any).mockResolvedValue({});
  (prismaMock.$transaction as any).mockImplementation((cb: any) => cb(tx));
  (tx.paymentIntent.findUnique as any).mockResolvedValue(intent());
  (tx.paymentIntent.update as any).mockResolvedValue(intent({ status: PaymentIntentStatus.SUCCEEDED }));
  (prismaMock.paymentWebhookEvent.update as any).mockResolvedValue({});
  (paystack.verifyTransaction as any).mockResolvedValue(verified());
});

describe('verifyAndReconcileByReference', () => {
  it('settles a PENDING intent into SUCCEEDED and posts inflow', async () => {
    const result: any = await service.verifyAndReconcileByReference('SMS-123');
    expect(result.settled).toBe(true);
    expect(result.alreadyReconciled).toBe(false);
    expect(result.status).toBe(PaymentIntentStatus.SUCCEEDED);
    expect(finance.processInflowCollection).toHaveBeenCalledTimes(1);
    expect((tx.paymentIntent.update as any).mock.calls[0][0].data.status).toBe(
      PaymentIntentStatus.SUCCEEDED,
    );
  });

  it('is a no-op if already SUCCEEDED with the same provider transaction id', async () => {
    (tx.paymentIntent.findUnique as any).mockResolvedValue(
      intent({ status: PaymentIntentStatus.SUCCEEDED, providerTransactionId: '777' }),
    );
    const result = await service.verifyAndReconcileByReference('SMS-123');
    expect(result.alreadyReconciled).toBe(true);
    expect(finance.processInflowCollection).not.toHaveBeenCalled();
  });

  it('throws 409 if already settled by a different transaction', async () => {
    (tx.paymentIntent.findUnique as any).mockResolvedValue(
      intent({ status: PaymentIntentStatus.SUCCEEDED, providerTransactionId: '999' }),
    );
    await expect(service.verifyAndReconcileByReference('SMS-123')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('throws 409 if the intent is not in a settleable state', async () => {
    (tx.paymentIntent.findUnique as any).mockResolvedValue(
      intent({ status: PaymentIntentStatus.CANCELLED }),
    );
    await expect(service.verifyAndReconcileByReference('SMS-123')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('throws 409 on amount mismatch', async () => {
    (paystack.verifyTransaction as any).mockResolvedValue(verified({ amount: 499999 }));
    await expect(service.verifyAndReconcileByReference('SMS-123')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Verified Paystack amount does not match the payment intent.',
    });
  });

  it('throws 409 on currency mismatch', async () => {
    (paystack.verifyTransaction as any).mockResolvedValue(verified({ currency: 'NGN' }));
    await expect(service.verifyAndReconcileByReference('SMS-123')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('throws 409 when verification reports non-success', async () => {
    (paystack.verifyTransaction as any).mockResolvedValue(verified({ status: 'failed' }));
    await expect(service.verifyAndReconcileByReference('SMS-123')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('throws 409 on reference mismatch from verification', async () => {
    (paystack.verifyTransaction as any).mockResolvedValue(verified({ reference: 'OTHER' }));
    await expect(service.verifyAndReconcileByReference('SMS-123')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('throws 404 when the intent does not exist', async () => {
    (tx.paymentIntent.findUnique as any).mockResolvedValue(null);
    await expect(service.verifyAndReconcileByReference('SMS-123')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws 400 when the student has no class placement', async () => {
    (tx.paymentIntent.findUnique as any).mockResolvedValue(
      intent({ student: { studentName: 'A', studentId: 'S1', placement: null } }),
    );
    await expect(service.verifyAndReconcileByReference('SMS-123')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('reconcileWebhookEvent', () => {
  it('returns alreadyReconciled for a processed event', async () => {
    (prismaMock.paymentWebhookEvent.findUnique as any).mockResolvedValue({
      id: 'e1',
      processedAt: new Date(),
      payload: { data: { reference: 'SMS-123' } },
    });
    const result = await service.reconcileWebhookEvent('e1');
    expect(result).toEqual({ alreadyReconciled: true });
  });

  it('throws 404 when the webhook event is missing', async () => {
    (prismaMock.paymentWebhookEvent.findUnique as any).mockResolvedValue(null);
    await expect(service.reconcileWebhookEvent('nope')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('settles and marks the event processed', async () => {
    (prismaMock.paymentWebhookEvent.findUnique as any).mockResolvedValue({
      id: 'e1',
      processedAt: null,
      payload: { data: { reference: 'SMS-123' } },
    });
    const result: any = await service.reconcileWebhookEvent('e1');
    expect(result.settled).toBe(true);
    expect(prismaMock.paymentWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'e1' } }),
    );
  });
});
