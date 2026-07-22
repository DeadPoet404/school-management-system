/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use any for flexibility */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IFinanceRepository } from '@/types/repositories';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    invoice: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    paymentCollection: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    expense: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    staffPayroll: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    teacherPayroll: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { FinanceService } from '@/modules/finance/finance.service';
import { createMockFinanceRepo } from '@/__tests__/helpers/mock-repositories';

// Type-safe accessor: cast repo methods to vi.Mock at each call site
function m(repo: IFinanceRepository, method: keyof IFinanceRepository) {
  return repo[method] as any;
}

describe('FinanceService', () => {
  let repo: IFinanceRepository;
  let service: FinanceService;

  beforeEach(() => {
    repo = createMockFinanceRepo();
    service = new FinanceService(repo);
    vi.clearAllMocks();
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn({}));
  });

  // ── getDashboardSummary ──
  describe('getDashboardSummary', () => {
    it('should aggregate finance dashboard totals, counts, and trend data', async () => {
      const now = new Date();

      (prisma.invoice.aggregate as any).mockResolvedValueOnce({
        _count: { _all: 3 },
        _sum: { amount: '3000', paidAmount: '1200' },
      });
      (prisma.paymentCollection.aggregate as any).mockResolvedValueOnce({
        _count: { _all: 2 },
        _sum: { amountPaid: '1300' },
      });
      (prisma.expense.aggregate as any).mockResolvedValueOnce({
        _count: { _all: 1 },
        _sum: { amount: '400' },
      });
      (prisma.staffPayroll.aggregate as any).mockResolvedValueOnce({
        _count: { _all: 1 },
        _sum: { baseSalary: '1000', deductions: '100' },
      });
      (prisma.teacherPayroll.aggregate as any).mockResolvedValueOnce({
        _count: { _all: 1 },
        _sum: { baseSalary: '2000', deductions: '200' },
      });
      (prisma.invoice.groupBy as any).mockResolvedValueOnce([
        { status: 'PAID', _count: { _all: 1 } },
        { status: 'PARTIAL', _count: { _all: 1 } },
        { status: 'UNPAID', _count: { _all: 1 } },
      ]);
      (prisma.staffPayroll.groupBy as any).mockResolvedValueOnce([
        { salaryStatus: 'PENDING', _count: { _all: 1 } },
      ]);
      (prisma.teacherPayroll.groupBy as any).mockResolvedValueOnce([
        { salaryStatus: 'DISBURSED', _count: { _all: 1 } },
      ]);
      (prisma.invoice.findMany as any).mockResolvedValueOnce([
        { amount: '1000', paidAmount: '200', createdAt: now },
      ]);
      (prisma.paymentCollection.findMany as any).mockResolvedValueOnce([
        { amountPaid: '500', dateProcessed: now },
      ]);
      (prisma.expense.findMany as any).mockResolvedValueOnce([
        { amount: '100', expenseDate: now },
      ]);

      const result = await service.getDashboardSummary(7);

      expect(result.windowDays).toBe(7);
      expect(result.totals.invoiced).toBe(3000);
      expect(result.totals.collected).toBe(1300);
      expect(result.totals.outstanding).toBe(1800);
      expect(result.totals.payroll).toBe(2700);
      expect(result.totals.outflows).toBe(3100);
      expect(result.totals.netCashflow).toBe(-1800);

      expect(result.counts.invoices).toBe(3);
      expect(result.counts.collections).toBe(2);
      expect(result.counts.expenses).toBe(1);
      expect(result.counts.payroll).toBe(2);
      expect(result.counts.paidInvoices).toBe(1);
      expect(result.counts.partialInvoices).toBe(1);
      expect(result.counts.openInvoices).toBe(2);
      expect(result.counts.pendingPayroll).toBe(1);

      expect(result.trend).toHaveLength(7);
      const todayPoint = result.trend.find((point) => point.date === now.toISOString().slice(0, 10));
      expect(todayPoint).toBeDefined();
      expect(todayPoint!.collected).toBe(500);
      expect(todayPoint!.expenses).toBe(100);
      expect(todayPoint!.payroll).toBe(2700);
    });
  });

  // ── getGlobalMatrix ──
  describe('getGlobalMatrix', () => {
    it('should return section-keyed matrix from repo', async () => {
      m(repo, 'findAllFeeConfigurations').mockResolvedValue([
        { sectionId: 'sec-1', components: [{ id: 'c1', name: 'Tuition', amount: '1000', frequency: 'Term', isMandatory: true }], issueDate: '2025-01-01', dueDate: '2025-03-01', allowInstallments: false, lateFeeRate: '5' },
      ]);

      const result = await service.getGlobalMatrix();

      expect(result['sec-1']).toBeDefined();
      expect(result['sec-1']!.components).toHaveLength(1);
      expect(result['sec-1']!.components[0]!.name).toBe('Tuition');
      expect(result['sec-1']!.billingConfig.allowInstallments).toBe(false);
    });

    it('should return empty object when no configurations exist', async () => {
      m(repo, 'findAllFeeConfigurations').mockResolvedValue([]);
      const result = await service.getGlobalMatrix();
      expect(result).toEqual({});
    });
  });

  // ── getPaginatedLedgers ──
  describe('getPaginatedLedgers', () => {
    it('should delegate to repo with correct skip/take', async () => {
      m(repo, 'findAllLedgerAccounts').mockResolvedValue([{ id: 'l1' }]);
      m(repo, 'countLedgerAccounts').mockResolvedValue(1);

      const result = await service.getPaginatedLedgers(10, 20);

      expect(m(repo, 'findAllLedgerAccounts')).toHaveBeenCalledWith(10, 20);
      expect(m(repo, 'countLedgerAccounts')).toHaveBeenCalledTimes(1);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ── getPaginatedPayroll ──
  describe('getPaginatedPayroll', () => {
    it('should merge staff and teacher payroll and paginate in memory', async () => {
      m(repo, 'getAllStaffPayroll').mockResolvedValue([
        { id: 'sp1', staff: { staffName: 'Staff A', account: { role: 'ADMIN' } }, baseSalary: '3000', deductions: '200', salaryStatus: 'PENDING' },
        { id: 'sp2', staff: { staffName: 'Staff B', account: { role: 'STAFF' } }, baseSalary: '2000', deductions: '100', salaryStatus: 'DISBURSED' },
      ]);
      m(repo, 'getAllTeacherPayroll').mockResolvedValue([
        { id: 'tp1', teacher: { teacherName: 'Teacher X', subject: 'Math' }, baseSalary: '2500', deductions: '150', salaryStatus: 'PENDING' },
      ]);
      m(repo, 'countStaffPayroll').mockResolvedValue(2);
      m(repo, 'countTeacherPayroll').mockResolvedValue(1);

      const result = await service.getPaginatedPayroll(0, 2);

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]!.name).toBe('Staff A');
      expect(result.data[1]!.name).toBe('Staff B');

      const page2 = await service.getPaginatedPayroll(2, 2);
      expect(page2.data).toHaveLength(1);
      expect(page2.data[0]!.name).toBe('Teacher X');
    });

    it('should map salary status correctly', async () => {
      m(repo, 'getAllStaffPayroll').mockResolvedValue([
        { id: 'sp1', staff: { staffName: 'A', account: { role: 'STAFF' } }, baseSalary: '1000', deductions: '0', salaryStatus: 'DISBURSED' },
      ]);
      m(repo, 'getAllTeacherPayroll').mockResolvedValue([]);
      m(repo, 'countStaffPayroll').mockResolvedValue(1);
      m(repo, 'countTeacherPayroll').mockResolvedValue(0);

      const result = await service.getPaginatedPayroll(0, 10);
      expect(result.data[0]!.status).toBe('Disbursed');
    });
  });

  // ── disbursePayroll ──
  describe('disbursePayroll', () => {
    it('should throw 404 when id matches neither staff nor teacher payroll', async () => {
      m(repo, 'findStaffPayrollById').mockResolvedValue(null);
      m(repo, 'findTeacherPayrollById').mockResolvedValue(null);

      await expect(service.disbursePayroll('nonexistent')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Payroll record not found for disbursement.',
      });
    });

    it('should disburse staff payroll when found', async () => {
      m(repo, 'findStaffPayrollById').mockResolvedValue({ id: 'sp1' });
      m(repo, 'disburseStaffPayroll').mockResolvedValue({});

      const result = await service.disbursePayroll('sp1');
      expect(result).toEqual({ success: true, type: 'STAFF' });
      expect(m(repo, 'disburseStaffPayroll')).toHaveBeenCalledWith('sp1', expect.anything());
      expect(m(repo, 'findTeacherPayrollById')).not.toHaveBeenCalled();
    });

    it('should disburse teacher payroll when staff not found', async () => {
      m(repo, 'findStaffPayrollById').mockResolvedValue(null);
      m(repo, 'findTeacherPayrollById').mockResolvedValue({ id: 'tp1' });
      m(repo, 'disburseTeacherPayroll').mockResolvedValue({});

      const result = await service.disbursePayroll('tp1');
      expect(result).toEqual({ success: true, type: 'TEACHER' });
      expect(m(repo, 'disburseTeacherPayroll')).toHaveBeenCalledWith('tp1', expect.anything());
    });
  });

  // ── generateInvoicesForSection ──
  describe('generateInvoicesForSection', () => {
    it('should throw 404 when no fee config for section', async () => {
      m(repo, 'findFeeConfigBySection').mockResolvedValue(null);
      await expect(service.generateInvoicesForSection('sec-unknown')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('sec-unknown'),
      });
    });

    it('should throw 400 when no students in section', async () => {
      m(repo, 'findFeeConfigBySection').mockResolvedValue({
        id: 'cfg-1', sectionId: 'sec-1', dueDate: new Date(),
        components: [{ amount: '1000' }],
      });
      m(repo, 'findStudentsMinimalBySection').mockResolvedValue([]);

      await expect(service.generateInvoicesForSection('sec-1')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('No active students'),
      });
    });

    it('should generate invoices for students without existing ones', async () => {
      m(repo, 'findFeeConfigBySection').mockResolvedValue({
        id: 'cfg-1', sectionId: 'sec-1', dueDate: new Date('2025-06-30'),
        components: [{ amount: '1500' }, { amount: '500' }],
      });
      m(repo, 'findStudentsMinimalBySection').mockResolvedValue([
        { id: 'stu-1' },
        { id: 'stu-2' },
      ]);
      // Bulk lookup: no students already invoiced
      m(repo, 'findExistingInvoiceStudentIds').mockResolvedValue(new Set());
      m(repo, 'countInvoices').mockResolvedValue(0);
      m(repo, 'createInvoice').mockResolvedValue({ id: 'inv-1' });
      m(repo, 'upsertBillingLedger').mockResolvedValue({});

      const result = await service.generateInvoicesForSection('sec-1');

      expect(result.message).toContain('2 invoices');
      expect(result.totalAmount).toBe(2000);
      expect(m(repo, 'createInvoice')).toHaveBeenCalledTimes(2);
      expect(m(repo, 'findExistingInvoiceStudentIds')).toHaveBeenCalledWith(
        ['stu-1', 'stu-2'],
        'cfg-1',
        expect.anything(),
      );
    });

    it('should skip students who already have an invoice for this config', async () => {
      m(repo, 'findFeeConfigBySection').mockResolvedValue({
        id: 'cfg-1', sectionId: 'sec-1', dueDate: new Date(),
        components: [{ amount: '1000' }],
      });
      m(repo, 'findStudentsMinimalBySection').mockResolvedValue([
        { id: 'stu-1' },
        { id: 'stu-2' },
      ]);
      // Bulk lookup: stu-1 already has an invoice
      m(repo, 'findExistingInvoiceStudentIds').mockResolvedValue(new Set(['stu-1']));
      m(repo, 'countInvoices').mockResolvedValue(0);
      m(repo, 'createInvoice').mockResolvedValue({ id: 'inv-new' });
      m(repo, 'upsertBillingLedger').mockResolvedValue({});

      const result = await service.generateInvoicesForSection('sec-1');

      expect(result.message).toContain('1 invoices');
      expect(m(repo, 'createInvoice')).toHaveBeenCalledTimes(1);
    });

    it('should throw 400 when all students already have invoices', async () => {
      m(repo, 'findFeeConfigBySection').mockResolvedValue({
        id: 'cfg-1', sectionId: 'sec-1', dueDate: new Date(),
        components: [{ amount: '1000' }],
      });
      m(repo, 'findStudentsMinimalBySection').mockResolvedValue([
        { id: 'stu-1' },
        { id: 'stu-2' },
      ]);
      // Bulk lookup: all students already invoiced
      m(repo, 'findExistingInvoiceStudentIds').mockResolvedValue(new Set(['stu-1', 'stu-2']));

      await expect(service.generateInvoicesForSection('sec-1')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('already have invoices'),
      });
      expect(m(repo, 'createInvoice')).not.toHaveBeenCalled();
    });
  });
});
