/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use any for flexibility */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    paymentCollection: { findMany: vi.fn(), aggregate: vi.fn() },
    expense: { findMany: vi.fn(), aggregate: vi.fn() },
    invoice: { findMany: vi.fn() },
    attendanceRecord: { findMany: vi.fn() },
    placement: { findMany: vi.fn() },
    student: { findMany: vi.fn() },
    gradeRecord: { findMany: vi.fn() },
    teacherPayroll: { findMany: vi.fn() },
    staffPayroll: { findMany: vi.fn() },
    billingLedger: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { AnalyticsService } from '@/modules/analytics/analytics.service';
import { requireRole, ROLES } from '@/middleware/rbac.middleware';
import { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { AppError } from '@/middleware/error.handler';

const service = new AnalyticsService();

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.paymentCollection.findMany.mockResolvedValue([]);
  prismaMock.expense.findMany.mockResolvedValue([]);
  prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: { _all: 0 } });
  prismaMock.invoice.findMany.mockResolvedValue([]);
  prismaMock.attendanceRecord.findMany.mockResolvedValue([]);
  prismaMock.placement.findMany.mockResolvedValue([]);
  prismaMock.student.findMany.mockResolvedValue([]);
  prismaMock.gradeRecord.findMany.mockResolvedValue([]);
  prismaMock.teacherPayroll.findMany.mockResolvedValue([]);
  prismaMock.staffPayroll.findMany.mockResolvedValue([]);
  prismaMock.paymentCollection.aggregate.mockResolvedValue({ _sum: { amountPaid: 0 }, _count: { _all: 0 } });
  prismaMock.billingLedger.findMany.mockResolvedValue([]);
  prismaMock.auditLog.findMany.mockResolvedValue([]);
});

describe('getCollectionsByChannel (SMS-011)', () => {
  it('groups channel totals/counts and zero-fills the monthly series', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    try {
      prismaMock.paymentCollection.findMany.mockResolvedValue([
        { amountPaid: 100, paymentMethod: 'CASH', dateProcessed: new Date('2026-08-10T00:00:00Z') },
        { amountPaid: 50, paymentMethod: 'CASH', dateProcessed: new Date('2026-08-20T00:00:00Z') },
        { amountPaid: 200, paymentMethod: 'CASH', dateProcessed: new Date('2026-09-05T00:00:00Z') },
        { amountPaid: 300, paymentMethod: 'MOBILE_MONEY', dateProcessed: new Date('2026-09-06T00:00:00Z') },
      ]);

      const data = await service.getCollectionsByChannel(3);

      expect(data.window).toMatchObject({ months: 3, startMonth: '2026-08', endMonth: '2026-10' });
      expect(data.channels).toEqual([
        { channel: 'CASH', total: 350, count: 3 },
        { channel: 'MOBILE_MONEY', total: 300, count: 1 },
      ]);
      expect(data.monthly).toHaveLength(3);
      expect(data.monthly[0]).toEqual({ month: '2026-08', total: 150, byChannel: { CASH: 150 } });
      expect(data.monthly[1]).toEqual({
        month: '2026-09',
        total: 500,
        byChannel: { CASH: 200, MOBILE_MONEY: 300 },
      });
      expect(data.monthly[2]).toEqual({ month: '2026-10', total: 0, byChannel: {} });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('getExpenseBreakdown (SMS-011)', () => {
  it('spends CLEARED rows only, reports pending meta, computes the monthly net position', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));
    try {
      prismaMock.expense.findMany.mockResolvedValue([
        { amount: 400, category: 'UTILITIES', expenseDate: new Date('2026-08-11T00:00:00Z') },
        { amount: 200, category: 'SUPPLIES', expenseDate: new Date('2026-09-03T00:00:00Z') },
      ]);
      prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 150 }, _count: { _all: 2 } });
      prismaMock.paymentCollection.findMany.mockResolvedValue([
        { amountPaid: 1000, dateProcessed: new Date('2026-09-04T00:00:00Z') },
      ]);

      const data = await service.getExpenseBreakdown(3);

      expect(data.spendBasis).toBe('CLEARED');
      expect(data.categories).toEqual([
        { category: 'UTILITIES', total: 400, count: 1 },
        { category: 'SUPPLIES', total: 200, count: 1 },
      ]);

      const clearedWhere = (prismaMock.expense.findMany.mock.calls[0]?.[0] as any).where;
      expect(clearedWhere.status).toBe('CLEARED');
      expect(data.pendingApproval).toEqual({ total: 150, count: 2 });

      expect(data.netPosition).toEqual([
        { month: '2026-07', collections: 0, expenses: 0, net: 0 },
        { month: '2026-08', collections: 0, expenses: 400, net: -400 },
        { month: '2026-09', collections: 1000, expenses: 200, net: 800 },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('getReceivablesAging (SMS-011)', () => {
  it('buckets outstanding invoice balances against today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-05T00:00:00Z'));
    try {
      prismaMock.invoice.findMany.mockResolvedValue([
        { amount: 500, paidAmount: 0, dueDate: new Date('2026-08-20T00:00:00Z') }, // current
        { amount: 300, paidAmount: 0, dueDate: new Date('2026-07-20T00:00:00Z') }, // 16d
        { amount: 400, paidAmount: 200, dueDate: new Date('2026-06-15T00:00:00Z') }, // 51d
        { amount: 400, paidAmount: 0, dueDate: new Date('2026-05-01T00:00:00Z') }, // 96d
        { amount: 700, paidAmount: 700, dueDate: new Date('2026-05-01T00:00:00Z') }, // settled -> skip
      ]);

      const data = await service.getReceivablesAging();

      expect(data.asOf).toBe('2026-08-05');
      expect(data.buckets.current).toEqual({ count: 1, amount: 500 });
      expect(data.buckets.days1to30).toEqual({ count: 1, amount: 300 });
      expect(data.buckets.days31to60).toEqual({ count: 1, amount: 200 });
      expect(data.buckets.over60).toEqual({ count: 1, amount: 400 });
      expect(data.totalOutstanding).toBe(1400);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('getAttendanceByClass (SMS-011)', () => {
  it('computes per-class rates over the target day (PRESENT|LATE numerator)', async () => {
    prismaMock.attendanceRecord.findMany.mockResolvedValue([
      { status: 'PRESENT', student: { placement: { class: { id: 'c1', name: 'JHS 1A', deletedAt: null } } } },
      { status: 'LATE', student: { placement: { class: { id: 'c1', name: 'JHS 1A', deletedAt: null } } } },
      { status: 'ABSENT', student: { placement: { class: { id: 'c1', name: 'JHS 1A', deletedAt: null } } } },
      { status: 'PRESENT', student: { placement: { class: { id: 'c1', name: 'JHS 1A', deletedAt: null } } } },
      { status: 'PRESENT', student: { placement: { class: { id: 'c2', name: 'JHS 2A', deletedAt: null } } } },
      { status: 'ABSENT', student: { placement: { class: { id: 'c2', name: 'JHS 2A', deletedAt: null } } } },
      { status: 'PRESENT', student: { placement: null } },
    ]);

    const data = await service.getAttendanceByClass({ date: '2026-08-05' });

    expect(data.date).toBe('2026-08-05');
    expect(data.range).toBe('day');
    expect(data.classes).toEqual([
      { classId: 'c1', className: 'JHS 1A', present: 3, total: 4, ratePct: 75 },
      { classId: 'c2', className: 'JHS 2A', present: 1, total: 2, ratePct: 50 },
    ]);
    expect(data.skippedUnassigned).toBe(1);
  });

  it('range=week widens the window to the trailing 7 days', async () => {
    await service.getAttendanceByClass({ date: '2026-08-05', range: 'week' });
    const where = (prismaMock.attendanceRecord.findMany.mock.calls[0]?.[0] as any).where;
    expect(where.date.gte.toISOString()).toBe('2026-07-30T00:00:00.000Z');
    expect(where.date.lte.toISOString()).toBe('2026-08-05T00:00:00.000Z');
  });
});

describe('getEnrollmentDistribution (SMS-011)', () => {
  it('counts ACTIVE students per class with gender split and an unassigned tail', async () => {
    prismaMock.placement.findMany.mockResolvedValue([
      { classId: 'c1', class: { name: 'JHS 1A', deletedAt: null }, student: { demographics: { gender: 'Male' } } },
      { classId: 'c1', class: { name: 'JHS 1A', deletedAt: null }, student: { demographics: { gender: 'Female' } } },
      { classId: 'c1', class: { name: 'JHS 1A', deletedAt: null }, student: { demographics: null } },
      { classId: 'c2', class: { name: 'JHS 2A', deletedAt: null }, student: { demographics: { gender: 'male' } } },
      { classId: null, class: null, student: { demographics: { gender: 'Female' } } },
    ]);

    const data = await service.getEnrollmentDistribution();

    expect(data.total).toBe(5);
    expect((prismaMock.placement.findMany.mock.calls[0]?.[0] as any).where).toEqual({
      student: { status: 'ACTIVE' },
    });
    expect(data.classes[0]).toEqual({
      classId: 'c1',
      className: 'JHS 1A',
      students: 3,
      male: 1,
      female: 1,
      other: 1,
    });
    expect(data.classes[1]).toMatchObject({ classId: 'c2', className: 'JHS 2A', students: 1, male: 1 });
    expect(data.classes[2]).toMatchObject({ classId: null, className: 'Unassigned', students: 1, female: 1 });
  });
});

describe('getAcademicPerformance (SMS-011)', () => {
  it('aggregates GPA, per-class averages, per-subject pass rates (F9 fails), distribution', async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { currentGpa: 0.5 },
      { currentGpa: 1.5 },
      { currentGpa: 2.5 },
      { currentGpa: 3.5 },
    ]);
    prismaMock.gradeRecord.findMany.mockResolvedValue([
      { finalScore: 80, gradePoints: 1.0, letterGrade: 'A1', class: { id: 'cA', name: 'JHS 1A' }, subject: { id: 'sM', name: 'Mathematics', code: 'MATH' } },
      { finalScore: 20, gradePoints: 0.0, letterGrade: 'F9', class: { id: 'cA', name: 'JHS 1A' }, subject: { id: 'sM', name: 'Mathematics', code: 'MATH' } },
      { finalScore: 70, gradePoints: 2.0, letterGrade: 'B2', class: { id: 'cA', name: 'JHS 1A' }, subject: { id: 'sE', name: 'English Language', code: 'ENG' } },
      { finalScore: 60, gradePoints: 2.0, letterGrade: 'B2', class: { id: 'cB', name: 'JHS 2A' }, subject: { id: 'sM', name: 'Mathematics', code: 'MATH' } },
    ]);

    const data = await service.getAcademicPerformance();

    expect(data.schoolAverageGpa).toBe(2);
    expect(data.activeStudents).toBe(4);
    expect(data.gpaDistribution).toEqual([
      { bucket: '0-1', students: 1 },
      { bucket: '1-2', students: 1 },
      { bucket: '2-3', students: 1 },
      { bucket: '3-4', students: 1 },
    ]);
    expect(data.perClass).toEqual([
      { classId: 'cA', className: 'JHS 1A', records: 3, averagePoints: 1, averageScore: 56.67 },
      { classId: 'cB', className: 'JHS 2A', records: 1, averagePoints: 2, averageScore: 60 },
    ]);
    expect(data.perSubject).toEqual([
      { subjectId: 'sE', subjectName: 'English Language', code: 'ENG', records: 1, passRatePct: 100 },
      { subjectId: 'sM', subjectName: 'Mathematics', code: 'MATH', records: 3, passRatePct: 67 },
    ]);
  });
});

describe('getPayrollSummary (SMS-011)', () => {
  it('sums teacher+staff net pay against the current month collections', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));
    try {
      prismaMock.teacherPayroll.findMany.mockResolvedValue([
        { netPay: 3000, salaryStatus: 'PAID' },
        { netPay: 2500, salaryStatus: 'PENDING' },
      ]);
      prismaMock.staffPayroll.findMany.mockResolvedValue([{ netPay: 2000, salaryStatus: 'PENDING' }]);
      prismaMock.paymentCollection.aggregate.mockResolvedValue({
        _sum: { amountPaid: 10000 },
        _count: { _all: 6 },
      });

      const data = await service.getPayrollSummary();

      expect(data.month).toBe('2026-08');
      expect(data.teachers).toEqual({ headcount: 2, netPayTotal: 5500, byStatus: { PAID: 1, PENDING: 1 } });
      expect(data.staff).toEqual({ headcount: 1, netPayTotal: 2000, byStatus: { PENDING: 1 } });
      expect(data.monthlyObligation).toBe(7500);
      expect(data.collectionsThisMonth).toBe(10000);
      expect(data.netPosition).toBe(2500);
      expect(data.coverageRatio).toBe(1.33);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('getTopDebtors (SMS-011)', () => {
  it('returns the mapped debtor shape', async () => {
    prismaMock.billingLedger.findMany.mockResolvedValue([
      {
        currentBalance: 1250,
        student: { id: 'i1', studentId: 'HHA-2024-0001', studentName: 'Ama Yaw Osei', placement: { class: { name: 'JHS 1A' } } },
      },
    ]);

    const data = await service.getTopDebtors(1);

    expect(data.debtors).toEqual([
      {
        studentInternalId: 'i1',
        studentId: 'HHA-2024-0001',
        studentName: 'Ama Yaw Osei',
        className: 'JHS 1A',
        balance: 1250,
      },
    ]);
  });

  it('clamps runaway limits at 50 (orderBy desc, take=clamped)', async () => {
    await service.getTopDebtors(500);
    const call = prismaMock.billingLedger.findMany.mock.calls[0]?.[0] as any;
    expect(call.take).toBe(50);
    expect(call.orderBy).toEqual({ currentBalance: 'desc' });
    expect(call.where).toEqual({ currentBalance: { gt: 0 } });
  });
});

describe('getActivityFeed (SMS-011)', () => {
  it('maps audit rows, derives entity from path, clamps limit at 100', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        id: 'a1',
        createdAt: new Date('2026-08-05T08:41:12Z'),
        actorId: 'u1',
        actorEmail: 'admin@sms.local',
        actorRole: 'ADMIN',
        action: 'CREATE_STUDENT',
        method: 'POST',
        path: '/api/students',
        responseStatus: 201,
      },
      {
        id: 'a2',
        createdAt: new Date('2026-08-05T08:40:00Z'),
        actorId: 'u2',
        actorEmail: 'staff01@horizon.local',
        actorRole: 'STAFF',
        action: 'LOGIN',
        method: 'POST',
        path: '/api/auth/login',
        responseStatus: 200,
      },
    ]);

    const data = await service.getActivityFeed(500);

    expect(data.limit).toBe(100);
    expect((prismaMock.auditLog.findMany.mock.calls[0]?.[0] as any).take).toBe(100);
    expect(data.events![0]).toMatchObject({
      action: 'CREATE_STUDENT',
      entity: 'students',
      actor: { email: 'admin@sms.local', role: 'ADMIN' },
      status: 201,
    });
    expect(data.events![1]).toMatchObject({ entity: 'auth', at: '2026-08-05T08:40:00.000Z' });
  });
});

describe('analytics route guard matrix (SMS-011)', () => {
  // Same tuple the nine new routes mount behind: requireRole(ADMIN, ACCOUNTANT, STAFF)
  const guard = requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF);
  const mockRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });

  it('rejects STUDENT and FACULTY with 403', () => {
    for (const role of [ROLES.STUDENT, ROLES.FACULTY]) {
      const next = vi.fn();
      guard({ user: { role } } as AuthenticatedRequest, mockRes() as any, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect((next.mock.calls[0]![0]! as AppError).statusCode).toBe(403);
    }
  });

  it('allows ADMIN, ACCOUNTANT and STAFF', () => {
    for (const role of [ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF]) {
      const next = vi.fn();
      guard({ user: { role } } as AuthenticatedRequest, mockRes() as any, next);
      expect(next).toHaveBeenCalledWith();
    }
  });
});
