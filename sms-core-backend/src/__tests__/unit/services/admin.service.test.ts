/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use any for flexibility */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/middleware/error.handler';

// Shared, hoisted mock state — vi.mock factories run before any top-level
// code, so the models must live in vi.hoisted.
const { callOrderRef, txModels, TX_MODELS } = vi.hoisted(() => {
  const TX_MODELS = [
    'guardian', 'paymentIntent', 'paymentCollection', 'payment', 'paymentWebhookEvent',
    'attendanceRecord', 'gradeRecord', 'studentDeparture', 'student',
    'staffAccount', 'teacherAccount', 'teacher', 'staff', 'subjectAllocation',
    'feeComponent', 'feeStructureConfiguration', 'feeTier', 'invoice', 'expense',
    'teacherPayroll', 'staffPayroll', 'billingLedger',
    'announcement', 'notificationDelivery', 'refreshToken', 'auditLog',
  ];
  const txModels: Record<string, any> = {};
  for (const name of TX_MODELS) {
    txModels[name] = {
      deleteMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    };
  }
  return { callOrderRef: { current: [] as string[] }, txModels, TX_MODELS };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ...txModels,
    systemConfig: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { AdminService } from '@/modules/admin/admin.service';

const ACTOR = { id: 'acc-admin-1', email: 'admin@school.com', role: 'ADMIN' };

function defaultSystemConfig() {
  return {
    id: 1,
    schoolName: 'Jocomfy School',
    schoolCode: 'JCS-2025',
    currency: 'GHS',
  };
}

function armMocks() {
  for (const name of TX_MODELS) {
    txModels[name].deleteMany.mockImplementation(async () => {
      callOrderRef.current.push(`${name}.deleteMany`);
      return { count: 2 };
    });
    txModels[name].count.mockResolvedValue(2);
    txModels[name].updateMany.mockImplementation(async () => {
      callOrderRef.current.push(`${name}.updateMany`);
      return { count: 3 };
    });
    txModels[name].findMany.mockResolvedValue([]);
    txModels[name].create.mockImplementation(async () => {
      callOrderRef.current.push(`${name}.create`);
      return { id: 'audit-1' };
    });
  }
  (prisma.systemConfig.findUnique as any).mockResolvedValue(defaultSystemConfig());
}

function wireTransaction() {
  (prisma.$transaction as any).mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
    await cb(txModels);
  });
}

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(() => {
    callOrderRef.current = [];
    vi.clearAllMocks();
    armMocks();
    service = new AdminService();
  });

  describe('wipeData confirmation guard', () => {
    it('rejects a confirm value that does not match the school code', async () => {
      await expect(service.wipeData({ scope: 'all', confirm: 'WRONG' }, ACTOR)).rejects.toThrow(AppError);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an empty confirm value', async () => {
      await expect(service.wipeData({ scope: 'students', confirm: '' }, ACTOR)).rejects.toThrow(AppError);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('students zone', () => {
    it('deletes payment intents BEFORE students (the only Restrict edge) in one transaction', async () => {
      wireTransaction();
      const result = await service.wipeData({ scope: 'students', confirm: 'JCS-2025' }, ACTOR);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const intentIdx = callOrderRef.current.indexOf('paymentIntent.deleteMany');
      const studentIdx = callOrderRef.current.indexOf('student.deleteMany');
      expect(intentIdx).toBeGreaterThanOrEqual(0);
      expect(studentIdx).toBeGreaterThan(intentIdx);
      // audit row is written inside the same transaction
      expect(callOrderRef.current[callOrderRef.current.length - 1]).toBe('auditLog.create');
      expect(txModels.auditLog.create.mock.calls[0][0].data.action).toBe('DATA_WIPE');
      expect(result.counts.students).toBe(2);
    });

    it('does not touch staff or teachers', async () => {
      wireTransaction();
      await service.wipeData({ scope: 'students', confirm: 'JCS-2025' }, ACTOR);
      expect(txModels.staff.deleteMany).not.toHaveBeenCalled();
      expect(txModels.teacher.deleteMany).not.toHaveBeenCalled();
      expect(txModels.feeTier.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('personnel zone', () => {
    it('protects admin-role accounts and clears subject allocations for removable teachers', async () => {
      wireTransaction();
      txModels.staffAccount.findMany.mockResolvedValue([{ staffId: 'stf-admin-1' }]);
      txModels.teacherAccount.findMany.mockResolvedValue([{ teacherId: 'tch-admin-1' }]);
      txModels.teacher.findMany.mockResolvedValue([
        { id: 'tch-1' },
        { id: 'tch-2' },
        { id: 'tch-admin-1' },
      ]);

      await service.wipeData({ scope: 'personnel', confirm: 'JCS-2025' }, ACTOR);

      expect(txModels.teacher.deleteMany).toHaveBeenCalledWith({
        where: { id: { notIn: ['tch-admin-1'] } },
      });
      expect(txModels.staff.deleteMany).toHaveBeenCalledWith({
        where: { id: { notIn: ['stf-admin-1'] } },
      });
      // allocations for any wiped teacher are cleared (plain-string FK)
      expect(txModels.subjectAllocation.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teacherId: { in: expect.any(Array) } } })
      );
    });
  });

  describe('financial zone', () => {
    it('zeroes billing ledger balances instead of deleting chart-of-accounts rows', async () => {
      wireTransaction();
      await service.wipeData({ scope: 'financial', confirm: 'JCS-2025' }, ACTOR);

      expect(txModels.billingLedger.updateMany).toHaveBeenCalledWith({
        where: {},
        data: { currentBalance: 0, initialDeposit: 0, creditBalance: 0 },
      });
      expect(txModels.billingLedger.deleteMany).not.toHaveBeenCalled();
      expect(txModels.expense.deleteMany).toHaveBeenCalled();
      expect(txModels.feeStructureConfiguration.deleteMany).toHaveBeenCalled();
    });

    it('does not delete students or personnel in the financial zone', async () => {
      wireTransaction();
      await service.wipeData({ scope: 'financial', confirm: 'JCS-2025' }, ACTOR);
      expect(txModels.student.deleteMany).not.toHaveBeenCalled();
      expect(txModels.staff.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('all zone', () => {
    it('runs every zone plus announcements/deliveries/refresh tokens, then audits', async () => {
      wireTransaction();
      const result = await service.wipeData({ scope: 'all', confirm: 'JCS-2025' }, ACTOR);

      for (const model of [
        'student', 'staff', 'teacher', 'expense', 'invoice',
        'announcement', 'notificationDelivery', 'refreshToken',
      ]) {
        expect(txModels[model].deleteMany.mock.calls.length).toBeGreaterThan(0);
      }
      expect(result.preserved).toEqual(
        expect.arrayContaining([expect.stringContaining('Admin accounts')])
      );
    });
  });

  describe('institution', () => {
    it('updates the singleton record', async () => {
      (prisma.systemConfig.update as any).mockResolvedValue({ id: 1, currency: 'GHS' });
      const updated = await service.updateInstitution({ currency: 'GHS', schoolName: 'Jocomfy Int.' });
      expect(prisma.systemConfig.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { currency: 'GHS', schoolName: 'Jocomfy Int.' },
      });
      expect(updated.currency).toBe('GHS');
    });

    it('throws when the singleton record is missing', async () => {
      (prisma.systemConfig.findUnique as any).mockResolvedValue(null);
      await expect(service.getInstitution()).rejects.toThrow(AppError);
    });
  });
});
