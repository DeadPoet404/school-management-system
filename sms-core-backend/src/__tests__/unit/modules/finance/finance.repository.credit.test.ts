/* eslint-disable @typescript-eslint/no-explicit-any -- transaction mocks only model the repository calls under test */
import { describe, expect, it, vi } from 'vitest';
import { FinanceRepository } from '@/modules/finance/finance.repository';

describe('FinanceRepository overpayment credits', () => {
  function transaction() {
    return {
      invoice: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      billingLedger: {
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
    } as any;
  }

  it('stores the amount above an invoice as student credit', async () => {
    const tx = transaction();
    tx.invoice.findFirst
      .mockResolvedValueOnce({ id: 'inv-1' })
      .mockResolvedValueOnce(null);
    tx.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      amount: '500.00',
      paidAmount: '0.00',
    });
    tx.invoice.update.mockResolvedValue({ id: 'inv-1', status: 'PAID' });
    tx.billingLedger.findUnique.mockResolvedValue({
      currentBalance: '500.00',
      creditBalance: '0.00',
    });

    const result = await new FinanceRepository().allocatePayment('stu-1', 650, tx);

    expect(result).toEqual({ appliedToInvoices: 500, appliedToLedger: 0, credited: 150 });
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { paidAmount: 500, status: 'PAID' },
    });
    expect(tx.billingLedger.update).toHaveBeenCalledWith({
      where: { studentId: 'stu-1' },
      data: {
        currentBalance: 0,
        creditBalance: { increment: 150 },
      },
    });
  });

  it('creates a ledger when an overpayment arrives before a ledger exists', async () => {
    const tx = transaction();
    tx.invoice.findFirst.mockResolvedValue(null);
    tx.billingLedger.findUnique.mockResolvedValue(null);

    const result = await new FinanceRepository().allocatePayment('stu-1', 125, tx);

    expect(result).toEqual({ appliedToInvoices: 0, appliedToLedger: 0, credited: 125 });
    expect(tx.billingLedger.create).toHaveBeenCalledWith({
      data: {
        studentId: 'stu-1',
        initialDeposit: 0,
        currentBalance: 0,
        creditBalance: 125,
      },
    });
  });

  it('applies saved credit to a later invoice and keeps any remainder', async () => {
    const tx = transaction();
    tx.billingLedger.findUnique.mockResolvedValue({
      currentBalance: '500.00',
      creditBalance: '150.00',
    });
    tx.invoice.findFirst
      .mockResolvedValueOnce({ id: 'inv-2' })
      .mockResolvedValueOnce(null);
    tx.invoice.findUnique.mockResolvedValue({
      id: 'inv-2',
      amount: '100.00',
      paidAmount: '0.00',
    });
    tx.invoice.update.mockResolvedValue({ id: 'inv-2', status: 'PAID' });

    const result = await new FinanceRepository().applyAvailableCredit('stu-1', tx);

    expect(result).toEqual({ applied: 100, remainingCredit: 50 });
    expect(tx.billingLedger.update).toHaveBeenCalledWith({
      where: { studentId: 'stu-1' },
      data: {
        currentBalance: 400,
        creditBalance: 50,
      },
    });
  });
});
