import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/middleware/error.handler';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    paymentCollection: { findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { FinanceService } from '@/modules/finance/finance.service';
import { createMockFinanceRepo } from '@/__tests__/helpers/mock-repositories';

describe('FinanceService', () => {
  let repo: ReturnType<typeof createMockFinanceRepo>;
  let service: FinanceService;

  beforeEach(() => {
    repo = createMockFinanceRepo();
    service = new FinanceService(repo);
    vi.clearAllMocks();
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn({}));
  });

  // ── getGlobalMatrix ──
  describe('getGlobalMatrix', () => {
    it('should return section-keyed matrix from repo', async () => {
      repo.findAllFeeConfigurations.mockResolvedValue([
        { sectionId: 'sec-1', components: [{ id: 'c1', name: 'Tuition', amount: '1000', frequency: 'Term', isMandatory: true }], issueDate: '2025-01-01', dueDate: '2025-03-01', allowInstallments: false, lateFeeRate: '5' },
      ]);

      const result = await service.getGlobalMatrix();

      expect(result['sec-1']).toBeDefined();
      expect(result['sec-1'].components).toHaveLength(1);
      expect(result['sec-1'].components[0].name).toBe('Tuition');
      expect(result['sec-1'].billingConfig.allowInstallments).toBe(false);
    });

    it('should return empty object when no configurations exist', async () => {
      repo.findAllFeeConfigurations.mockResolvedValue([]);
      const result = await service.getGlobalMatrix();
      expect(result).toEqual({});
    });
  });

  // ── getPaginatedLedgers ──
  describe('getPaginatedLedgers', () => {
    it('should delegate to repo with correct skip/take', async () => {
      repo.findAllLedgerAccounts.mockResolvedValue([{ id: 'l1' }]);
      repo.countLedgerAccounts.mockResolvedValue(1);

      const result = await service.getPaginatedLedgers(10, 20);

      expect(repo.findAllLedgerAccounts).toHaveBeenCalledWith(10, 20);
      expect(repo.countLedgerAccounts).toHaveBeenCalledTimes(1);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ── getPaginatedPayroll ──
  describe('getPaginatedPayroll', () => {
    it('should merge staff and teacher payroll and paginate in memory', async () => {
      repo.getAllStaffPayroll.mockResolvedValue([
        { id: 'sp1', staff: { staffName: 'Staff A', account: { role: 'ADMIN' } }, baseSalary: '3000', deductions: '200', salaryStatus: 'PENDING' },
        { id: 'sp2', staff: { staffName: 'Staff B', account: { role: 'STAFF' } }, baseSalary: '2000', deductions: '100', salaryStatus: 'DISBURSED' },
      ]);
      repo.getAllTeacherPayroll.mockResolvedValue([
        { id: 'tp1', teacher: { teacherName: 'Teacher X', subject: 'Math' }, baseSalary: '2500', deductions: '150', salaryStatus: 'PENDING' },
      ]);
      repo.countStaffPayroll.mockResolvedValue(2);
      repo.countTeacherPayroll.mockResolvedValue(1);

      // Page 1, limit 2 → should return first 2 of 3 total
      const result = await service.getPaginatedPayroll(0, 2);

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('Staff A');
      expect(result.data[1].name).toBe('Staff B');

      // Page 2, limit 2 → should return 1 remaining
      const page2 = await service.getPaginatedPayroll(2, 2);
      expect(page2.data).toHaveLength(1);
      expect(page2.data[0].name).toBe('Teacher X');
    });

    it('should map salary status correctly', async () => {
      repo.getAllStaffPayroll.mockResolvedValue([
        { id: 'sp1', staff: { staffName: 'A', account: { role: 'STAFF' } }, baseSalary: '1000', deductions: '0', salaryStatus: 'DISBURSED' },
      ]);
      repo.getAllTeacherPayroll.mockResolvedValue([]);
      repo.countStaffPayroll.mockResolvedValue(1);
      repo.countTeacherPayroll.mockResolvedValue(0);

      const result = await service.getPaginatedPayroll(0, 10);
      expect(result.data[0].status).toBe('Disbursed');
    });
  });

  // ── disbursePayroll ──
  describe('disbursePayroll', () => {
    it('should throw 404 when id matches neither staff nor teacher payroll', async () => {
      repo.findStaffPayrollById.mockResolvedValue(null);
      repo.findTeacherPayrollById.mockResolvedValue(null);

      await expect(service.disbursePayroll('nonexistent')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Payroll record not found for disbursement.',
      });
    });

    it('should disburse staff payroll when found', async () => {
      repo.findStaffPayrollById.mockResolvedValue({ id: 'sp1' });
      repo.disburseStaffPayroll.mockResolvedValue({});

      const result = await service.disbursePayroll('sp1');
      expect(result).toEqual({ success: true, type: 'STAFF' });
      expect(repo.disburseStaffPayroll).toHaveBeenCalledWith('sp1', expect.anything());
      expect(repo.findTeacherPayrollById).not.toHaveBeenCalled(); // Short-circuited
    });

    it('should disburse teacher payroll when staff not found', async () => {
      repo.findStaffPayrollById.mockResolvedValue(null);
      repo.findTeacherPayrollById.mockResolvedValue({ id: 'tp1' });
      repo.disburseTeacherPayroll.mockResolvedValue({});

      const result = await service.disbursePayroll('tp1');
      expect(result).toEqual({ success: true, type: 'TEACHER' });
      expect(repo.disburseTeacherPayroll).toHaveBeenCalledWith('tp1', expect.anything());
    });
  });

  // ── generateInvoicesForSection ──
  describe('generateInvoicesForSection', () => {
    it('should throw 404 when no fee config for section', async () => {
      repo.findFeeConfigBySection.mockResolvedValue(null);
      await expect(service.generateInvoicesForSection('sec-unknown')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('sec-unknown'),
      });
    });

    it('should throw 400 when no students in section', async () => {
      repo.findFeeConfigBySection.mockResolvedValue({
        id: 'cfg-1', sectionId: 'sec-1', dueDate: new Date(),
        components: [{ amount: '1000' }],
      });
      repo.findStudentsMinimalBySection.mockResolvedValue([]);

      await expect(service.generateInvoicesForSection('sec-1')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('No active students'),
      });
    });

    it('should generate invoices for students without existing ones', async () => {
      repo.findFeeConfigBySection.mockResolvedValue({
        id: 'cfg-1', sectionId: 'sec-1', dueDate: new Date('2025-06-30'),
        components: [{ amount: '1500' }, { amount: '500' }],
      });
      repo.findStudentsMinimalBySection.mockResolvedValue([
        { id: 'stu-1' },
        { id: 'stu-2' },
      ]);
      // No existing invoices for either student
      repo.findExistingInvoice.mockResolvedValue(null);
      repo.countInvoices.mockResolvedValue(0);
      repo.createInvoice.mockResolvedValue({ id: 'inv-1' });
      repo.upsertBillingLedger.mockResolvedValue({});

      const result = await service.generateInvoicesForSection('sec-1');

      expect(result.message).toContain('2 invoices');
      expect(result.totalAmount).toBe(2000); // 1500 + 500
      expect(repo.createInvoice).toHaveBeenCalledTimes(2);
    });

    it('should skip students who already have an invoice for this config', async () => {
      repo.findFeeConfigBySection.mockResolvedValue({
        id: 'cfg-1', sectionId: 'sec-1', dueDate: new Date(),
        components: [{ amount: '1000' }],
      });
      repo.findStudentsMinimalBySection.mockResolvedValue([
        { id: 'stu-1' },
        { id: 'stu-2' },
      ]);
      // stu-1 already has invoice, stu-2 does not
      repo.findExistingInvoice
        .mockResolvedValueOnce({ id: 'existing-inv' }) // stu-1
        .mockResolvedValueOnce(null);                   // stu-2
      repo.countInvoices.mockResolvedValue(0);
      repo.createInvoice.mockResolvedValue({ id: 'inv-new' });
      repo.upsertBillingLedger.mockResolvedValue({});

      const result = await service.generateInvoicesForSection('sec-1');

      expect(result.message).toContain('1 invoices');
      expect(repo.createInvoice).toHaveBeenCalledTimes(1);
    });
  });
});
