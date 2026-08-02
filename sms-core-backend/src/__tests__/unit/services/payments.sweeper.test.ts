/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, paystackMock, reconciliationMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      paymentIntent: { findMany: vi.fn() },
    },
    paystackMock: { isConfigured: vi.fn(() => true) },
    reconciliationMock: {
      verifyAndReconcileByReference: vi.fn().mockResolvedValue({ settled: true }),
    },
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/modules/payments/paystack.client', () => ({
  PaystackClient: class {
    isConfigured = paystackMock.isConfigured;
  },
}));
vi.mock('@/modules/payments/payments.reconciliation.service', () => ({
  PaymentsReconciliationService: class {
    verifyAndReconcileByReference = reconciliationMock.verifyAndReconcileByReference;
  },
}));

import { PaymentsSweeper } from '@/modules/payments/payments.sweeper';

beforeEach(() => {
  vi.clearAllMocks();
  (paystackMock.isConfigured as any).mockReturnValue(true);
  (reconciliationMock.verifyAndReconcileByReference as any).mockResolvedValue({ settled: true });
  (prismaMock.paymentIntent.findMany as any).mockResolvedValue([
    { reference: 'SMS-1' },
    { reference: 'SMS-2' },
  ]);
});

describe('PaymentsSweeper.run', () => {
  it('does nothing when Paystack is not configured (no DB query)', async () => {
    (paystackMock.isConfigured as any).mockReturnValue(false);
    const sweeper = new PaymentsSweeper();
    await sweeper.run();
    expect(prismaMock.paymentIntent.findMany).not.toHaveBeenCalled();
  });

  it('skips reconciliation when there are no stale pending intents', async () => {
    (prismaMock.paymentIntent.findMany as any).mockResolvedValue([]);
    const sweeper = new PaymentsSweeper();
    await sweeper.run();
    expect(reconciliationMock.verifyAndReconcileByReference).not.toHaveBeenCalled();
  });

  it('reconciles every stale pending intent', async () => {
    const sweeper = new PaymentsSweeper();
    await sweeper.run();
    expect(prismaMock.paymentIntent.findMany).toHaveBeenCalledTimes(1);
    expect(reconciliationMock.verifyAndReconcileByReference).toHaveBeenCalledTimes(2);
    expect(reconciliationMock.verifyAndReconcileByReference).toHaveBeenCalledWith('SMS-1');
    expect(reconciliationMock.verifyAndReconcileByReference).toHaveBeenCalledWith('SMS-2');
  });

  it('continues past a failing intent so the next cycle can retry the rest', async () => {
    (reconciliationMock.verifyAndReconcileByReference as any)
      .mockResolvedValueOnce({ settled: true })
      .mockRejectedValueOnce(new Error('verify failed'));
    const sweeper = new PaymentsSweeper();
    await expect(sweeper.run()).resolves.toBeUndefined();
    expect(reconciliationMock.verifyAndReconcileByReference).toHaveBeenCalledTimes(2);
  });
});
