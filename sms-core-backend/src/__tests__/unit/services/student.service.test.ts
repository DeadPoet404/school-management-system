/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use any for flexibility */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/middleware/error.handler';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    feeTier: { findUnique: vi.fn() },
    class: { findUnique: vi.fn() },
    student: { findMany: vi.fn(), findUnique: vi.fn() },
    invoice: { groupBy: vi.fn() },
    payment: { groupBy: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/utils/hash', () => ({
  hashPassword: vi.fn().mockResolvedValue('$hashed$'),
}));

import { prisma } from '@/lib/prisma';
import { StudentService } from '@/modules/students/student.service';
import { createMockStudentRepo } from '@/__tests__/helpers/mock-repositories';

// ── Fixtures ──
const FOUND_STUDENT = {
  id: 'stu-uuid-1',
  studentId: 'STU-DEPT-abc123',
  studentName: 'John Doe',
  status: 'ACTIVE',
  account: { id: 'acc-1', studentId: 'STU-DEPT-abc123', portalEmail: 'john@school.com' },
  demographics: { gender: 'Male' },
  placement: { classId: 'class-1' },
};

const DEPARTED_STUDENT = { ...FOUND_STUDENT, status: 'DEPARTED' };

const VALID_ENROLLMENT_PAYLOAD = {
  account: { fullName: 'Jane Doe', email: 'jane@school.com', password: 'pw123', enrollmentDate: '2025-01-15' },
  demographics: { dateOfBirth: '2010-05-20', gender: 'Female', residentialAddress: '123 Street' },
  placement: { classId: 'class-1', academicTrack: 'Science', boardingStatus: 'Day' },
  guardian: { name: 'Parent Doe', relationship: 'Mother', phone: '0551234567' },
  billing: { feeTierId: 'TIER-A', initialDeposit: 500 },
};

describe('StudentService', () => {
  let repo: ReturnType<typeof createMockStudentRepo>;
  let service: StudentService;

  beforeEach(() => {
    repo = createMockStudentRepo();
    service = new StudentService(repo);
    vi.clearAllMocks();

    // Default: transaction executes callback immediately with mock tx
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn({}));
    // Default: feeTier found
    (prisma.feeTier.findUnique as any).mockResolvedValue({ id: 'tier-uuid-a', code: 'TIER-A', amount: '2000', isActive: true });
    // Default: enrolling class resolves to a canonical ladder rung, and the
    // cohort has no members yet, so the first id issued is sequence 001.
    (prisma.class.findUnique as any).mockResolvedValue({ name: 'Grade 3A' });
    (prisma.student.findMany as any).mockResolvedValue([]);
    (prisma.student.findUnique as any).mockResolvedValue(null);
  });

  // ── getById ──
  describe('getById', () => {
    it('should throw 404 when student not found', async () => {
      (repo.findById as any).mockResolvedValue(null);
      await expect(service.getById('nonexistent')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Student not found with ID: nonexistent',
      });
    });

    it('should return student when found (read endpoints normalize money fields)', async () => {
      (repo.findById as any).mockResolvedValue(FOUND_STUDENT);
      const result = await service.getById('stu-uuid-1');
      expect(result).toEqual({ ...FOUND_STUDENT, invoices: [], payments: [] });
      expect(repo.findById).toHaveBeenCalledWith('stu-uuid-1');
    });
  });

  // ── getFilteredPaginated ──
  describe('getFilteredPaginated', () => {
    it('should call findAllFiltered and countFiltered with empty filters', async () => {
      (repo.findAllFiltered as any).mockResolvedValue([FOUND_STUDENT]);
      (repo.countFiltered as any).mockResolvedValue(1);

      const result = await service.getFilteredPaginated({}, 0, 20);

      expect(repo.findAllFiltered).toHaveBeenCalledTimes(1);
      expect(repo.countFiltered).toHaveBeenCalledTimes(1);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass search filter to findAllFiltered', async () => {
      (repo.findAllFiltered as any).mockResolvedValue([]);
      (repo.countFiltered as any).mockResolvedValue(0);

      await service.getFilteredPaginated({ search: 'john' }, 0, 20);

      const whereArg = (repo.findAllFiltered as any).mock.calls[0][0];
      expect(whereArg.studentName).toBeDefined();
      expect(whereArg.studentName.contains).toBe('john');
    });

    it('should search the student name only (not guardians, email, or class)', async () => {
      (repo.findAllFiltered as any).mockResolvedValue([]);
      (repo.countFiltered as any).mockResolvedValue(0);

      await service.getFilteredPaginated({ search: 'adwoa' }, 0, 20);

      const whereArg = (repo.findAllFiltered as any).mock.calls[0][0];
      expect(whereArg.studentName.contains).toBe('adwoa');
      expect(whereArg.studentName.mode).toBe('insensitive');
      expect(whereArg.OR).toBeUndefined();
      expect(whereArg.guardians).toBeUndefined();
      expect(whereArg.account).toBeUndefined();
    });

    it('should normalize and pass status filters', async () => {
      (repo.findAllFiltered as any).mockResolvedValue([]);
      (repo.countFiltered as any).mockResolvedValue(0);

      await service.getFilteredPaginated({ status: 'departed' }, 0, 20);

      const whereArg = (repo.findAllFiltered as any).mock.calls[0][0];
      expect(whereArg.status).toBe('DEPARTED');
    });

    it('should apply class, gender, boarding, GPA, and attendance filters', async () => {
      (repo.findAllFiltered as any).mockResolvedValue([]);
      (repo.countFiltered as any).mockResolvedValue(0);

      await service.getFilteredPaginated({
        classId: 'class-1',
        gender: 'female',
        boardingStatus: 'DAY',
        minGpa: '2.5',
        minAttendance: '80',
      }, 0, 20);

      const whereArg = (repo.findAllFiltered as any).mock.calls[0][0];
      expect(whereArg.placement.classId).toBe('class-1');
      expect(whereArg.placement.boardingStatus.in).toContain('DAY_STUDENT');
      expect(whereArg.demographics.gender).toEqual({
        equals: 'female',
        mode: 'insensitive',
      });
      expect(whereArg.currentGpa).toEqual({ gte: 2.5 });
      expect(whereArg.attendanceRate).toEqual({ gte: 80 });
    });

    it('should reject invalid filter values', async () => {
      await expect(
        service.getFilteredPaginated({ status: 'UNKNOWN' }, 0, 20),
      ).rejects.toMatchObject({ statusCode: 400 });

      await expect(
        service.getFilteredPaginated({ minAttendance: '101' }, 0, 20),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ── update ──
  describe('update', () => {
    it('should throw 404 when student not found', async () => {
      (repo.findById as any).mockResolvedValue(null);
      await expect(service.update('nonexistent', { studentName: 'X' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 409 when student is departed', async () => {
      (repo.findById as any).mockResolvedValue(DEPARTED_STUDENT);
      await expect(service.update('stu-uuid-1', { studentName: 'X' })).rejects.toMatchObject({
        statusCode: 409,
        message: 'Cannot update a departed student.',
      });
    });

    it('should convert dateOfBirth string to Date before passing to repo', async () => {
      (repo.findById as any).mockResolvedValue(FOUND_STUDENT);
      (repo.update as any).mockResolvedValue(FOUND_STUDENT);

      await service.update('stu-uuid-1', {
        demographics: { dateOfBirth: '2010-05-20' },
      });

      const updateArg = (repo.update as any).mock.calls[0][1];
      expect(updateArg.demographics.dateOfBirth).toBeInstanceOf(Date);
    });

    it('should call repo.update with id and payload', async () => {
      (repo.findById as any).mockResolvedValue(FOUND_STUDENT);
      (repo.update as any).mockResolvedValue(FOUND_STUDENT);

      await service.update('stu-uuid-1', { studentName: 'Updated Name' });

      expect(repo.update).toHaveBeenCalledWith('stu-uuid-1', { studentName: 'Updated Name' });
    });
  });

  // ── processDeparture ──
  describe('processDeparture', () => {
    const DEPARTURE_PAYLOAD = {
      studentId: 'STU-DEPT-abc123',
      departureType: 'TRANSFER',
      effectiveDate: '2025-06-01',
      disposition: { treasuryClearanceStatus: 'CLEARED', academicRecordsArchived: true },
      remarks: 'Transferred to another school',
    };

    it('should throw 404 when studentId not found', async () => {
      (repo.findByPublicId as any).mockResolvedValue(null);
      await expect(service.processDeparture(DEPARTURE_PAYLOAD)).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('STU-DEPT-abc123'),
      });
    });

    it('should throw 409 when student already departed', async () => {
      (repo.findByPublicId as any).mockResolvedValue(DEPARTED_STUDENT);
      await expect(service.processDeparture(DEPARTURE_PAYLOAD)).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('already been processed'),
      });
    });

    it('should create departure log and update status to DEPARTED', async () => {
      (repo.findByPublicId as any).mockResolvedValue(FOUND_STUDENT);
      (repo.createDepartureLog as any).mockResolvedValue({ id: 'dep-1' });
      (repo.updateStatus as any).mockResolvedValue({});

      const result = await service.processDeparture(DEPARTURE_PAYLOAD);

      expect(repo.createDepartureLog).toHaveBeenCalledTimes(1);
      expect(repo.updateStatus).toHaveBeenCalledWith('stu-uuid-1', 'DEPARTED', expect.anything());
      expect(result).toEqual({ id: 'dep-1' });
    });
  });

  // ── createStudent ──
  describe('createStudent', () => {
    it('should throw 400 when neither guardian nor parent provided', async () => {
      await expect(service.createStudent({
        ...VALID_ENROLLMENT_PAYLOAD,
        guardian: undefined,
      } as any)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('guardian'),
      });
    });

    it('should throw 400 when guardian is undefined and parent is undefined', async () => {
      await expect(service.createStudent({
        ...VALID_ENROLLMENT_PAYLOAD,
        guardian: undefined,
      } as any)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should use parent as fallback when guardian is missing', async () => {
      (repo.createNestedStudent as any).mockResolvedValue({ id: 'new-1', studentId: 'STU-X', studentName: 'Jane' });

      const payload = { ...VALID_ENROLLMENT_PAYLOAD, guardian: undefined, parent: VALID_ENROLLMENT_PAYLOAD.guardian };
      const result = await service.createStudent(payload);

      expect(repo.createNestedStudent).toHaveBeenCalledTimes(1);
      expect(result.studentName).toBe('Jane');
    });

    it('should calculate balance as feeTier amount minus initial deposit', async () => {
      (prisma.feeTier.findUnique as any).mockResolvedValue({ id: 'tier-uuid-a', code: 'TIER-A', amount: '2000', isActive: true });
      (repo.createNestedStudent as any).mockResolvedValue({ id: 'new-1', studentId: 'STU-X', studentName: 'Jane' });

      await service.createStudent({
        ...VALID_ENROLLMENT_PAYLOAD,
        billing: { feeTierId: 'TIER-A', initialDeposit: 500 },
      });

      const createData = (repo.createNestedStudent as any).mock.calls[0][0];
      expect(createData.billing.create.currentBalance).toBe(1500);
    });

    // D-05: an unresolvable tier must fail loudly. This test previously
    // asserted a 0.00 balance, which is the silent revenue-loss bug itself.
    it('should throw 400 when the fee tier cannot be resolved', async () => {
      (prisma.feeTier.findUnique as any).mockResolvedValue(null);

      await expect(service.createStudent({
        ...VALID_ENROLLMENT_PAYLOAD,
        billing: { feeTierId: 'UNKNOWN', initialDeposit: 500 },
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Unknown fee tier: UNKNOWN',
      });

      expect(repo.createNestedStudent).not.toHaveBeenCalled();
    });

    it('should throw 400 when the fee tier is inactive', async () => {
      (prisma.feeTier.findUnique as any).mockResolvedValue({
        id: 'tier-uuid-a', code: 'TIER-A', amount: '2000', isActive: false,
      });

      await expect(service.createStudent({
        ...VALID_ENROLLMENT_PAYLOAD,
        billing: { feeTierId: 'TIER-A', initialDeposit: 500 },
      })).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('inactive'),
      });

      expect(repo.createNestedStudent).not.toHaveBeenCalled();
    });

    it('should throw 400 when the initial deposit is negative', async () => {
      await expect(service.createStudent({
        ...VALID_ENROLLMENT_PAYLOAD,
        billing: { feeTierId: 'TIER-A', initialDeposit: -100 },
      })).rejects.toMatchObject({ statusCode: 400 });

      expect(repo.createNestedStudent).not.toHaveBeenCalled();
    });

    // D-05 regression: the FK must receive the tier UUID, never the code,
    // and the balance must equal tier amount minus deposit.
    it('should store the tier UUID and bill amount minus deposit', async () => {
      (repo.createNestedStudent as any).mockResolvedValue({
        id: 'new-1', studentId: 'STU-X', studentName: 'Jane',
      });

      await service.createStudent({
        ...VALID_ENROLLMENT_PAYLOAD,
        billing: { feeTierId: 'TIER-A', initialDeposit: 500 },
      });

      const createData = (repo.createNestedStudent as any).mock.calls[0][0];
      expect(createData.billing.create.feeTierId).toBe('tier-uuid-a');
      expect(createData.billing.create.currentBalance).toBe(1500);
    });

    it('should create two guardians when guardian2 is provided (first is primary)', async () => {
      (prisma.feeTier.findUnique as any).mockResolvedValue({ id: 'tier-uuid-a', code: 'TIER-A', amount: '2000', isActive: true });
      (repo.createNestedStudent as any).mockResolvedValue({ id: 'new-1', studentId: 'STU-X', studentName: 'Jane' });

      await service.createStudent({
        ...VALID_ENROLLMENT_PAYLOAD,
        guardian2: { name: 'Comfort Mensah', relationship: 'MOTHER', phone: '0240000000', email: null },
      });

      const createData = (repo.createNestedStudent as any).mock.calls[0][0];
      expect(Array.isArray(createData.guardians.create)).toBe(true);
      expect(createData.guardians.create).toHaveLength(2);
      expect(createData.guardians.create[0].name).toBe('Parent Doe');
      expect(createData.guardians.create[1].name).toBe('Comfort Mensah');
    });

    it('should create a single guardian when guardian2 is omitted', async () => {
      (prisma.feeTier.findUnique as any).mockResolvedValue({ id: 'tier-uuid-a', code: 'TIER-A', amount: '2000', isActive: true });
      (repo.createNestedStudent as any).mockResolvedValue({ id: 'new-1', studentId: 'STU-X', studentName: 'Jane' });

      await service.createStudent(VALID_ENROLLMENT_PAYLOAD);

      const createData = (repo.createNestedStudent as any).mock.calls[0][0];
      expect(createData.guardians.create).toHaveLength(1);
      expect(createData.guardians.create[0].name).toBe('Parent Doe');
    });

    it('should throw 400 when guardian2 is provided but incomplete', async () => {
      await expect(service.createStudent({
        ...VALID_ENROLLMENT_PAYLOAD,
        guardian2: { name: 'Comfort Mensah', relationship: 'MOTHER', phone: '   ' },
      })).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Second guardian'),
      });
    });
  });

  // ── getFinancialMatrix ──
  describe('getFinancialMatrix', () => {
    it('should aggregate invoice and payment totals per student', async () => {
      (repo.findWithFinancialData as any).mockResolvedValue([
        { id: 's1', studentId: 'STU-1', studentName: 'A', status: 'ACTIVE', account: {}, invoices: [], payments: [] },
        { id: 's2', studentId: 'STU-2', studentName: 'B', status: 'ACTIVE', account: {}, invoices: [], payments: [] },
      ]);

      (prisma.invoice.groupBy as any).mockResolvedValue([
        { studentId: 's1', _sum: { amount: '2000' } },
      ]);
      (prisma.payment.groupBy as any).mockResolvedValue([
        { studentId: 's1', _sum: { amount: '1500' } },
      ]);

      const result = await service.getFinancialMatrix();

      expect(result).toHaveLength(2);
      // Student s1: invoiced 2000, paid 1500 → Partial
      expect(result[0]!.amountPaid).toBe(1500);
      expect(result[0]!.balanceRemaining).toBe(500);
      expect(result[0]!.feesStatus).toBe('Partial');
      // Student s2: no invoices, no payments → Unpaid
      expect(result[1]!.amountPaid).toBe(0);
      expect(result[1]!.feesStatus).toBe('Unpaid');
    });

    it('should mark as Paid when balance is 0 and payments exist', async () => {
      (repo.findWithFinancialData as any).mockResolvedValue([
        { id: 's1', studentId: 'STU-1', studentName: 'A', status: 'ACTIVE', account: {}, invoices: [{ invoiceNo: 'INV-1', amount: '1000', createdAt: new Date() }], payments: [{ receiptNo: 'PAY-1', amount: '1000', paymentType: 'Cash', createdAt: new Date() }] },
      ]);
      (prisma.invoice.groupBy as any).mockResolvedValue([{ studentId: 's1', _sum: { amount: '1000' } }]);
      (prisma.payment.groupBy as any).mockResolvedValue([{ studentId: 's1', _sum: { amount: '1000' } }]);

      const result = await service.getFinancialMatrix();
      expect(result[0]!.feesStatus).toBe('Paid');
      expect(result[0]!.lastTransactionId).toBe('PAY-1');
    });
  });

  describe('money normalization (Prisma Decimal strings → numbers)', () => {
    // Regression: /students ships invoice/payment Decimals; JSON serializes
    // them as strings and the registry Fees Info tab does .toFixed() on them,
    // which threw "toFixed is not a function" once real invoices existed.
    const studentWithDecimalStrings = {
      ...FOUND_STUDENT,
      invoices: [
        { id: 'inv-1', invoiceNo: 'INV-LGY-0001', amount: '1610.00', paidAmount: '1000.00', status: 'PARTIAL', dueDate: new Date('2026-12-20'), createdAt: new Date('2026-09-01T00:00:00Z') },
      ],
      payments: [
        { id: 'pay-1', receiptNo: 'REC-LGY-0001', amount: '1000.00', paymentType: 'Cash', createdAt: new Date('2026-09-02T00:00:00Z') },
      ],
      billing: { currentBalance: '610.00', initialDeposit: '0.00', feeTierId: 'tier-1' },
    };

    it('should normalize invoice/payment/billing Decimals in getFilteredPaginated', async () => {
      (repo.findAllFiltered as any).mockResolvedValue([studentWithDecimalStrings]);
      (repo.countFiltered as any).mockResolvedValue(1);

      const { data } = await service.getFilteredPaginated({}, 0, 50);

      expect(data).toHaveLength(1);
      expect(data[0].invoices[0].amount).toBe(1610);
      expect(data[0].invoices[0].paidAmount).toBe(1000);
      expect(data[0].payments[0].amount).toBe(1000);
      expect(data[0].billing.currentBalance).toBe(610);
      expect(data[0].billing.initialDeposit).toBe(0);
      // Non-money fields pass through untouched
      expect(data[0].studentName).toBe('John Doe');
      expect(data[0].invoices[0].invoiceNo).toBe('INV-LGY-0001');
    });

    it('should normalize in getById', async () => {
      (repo.findById as any).mockResolvedValue(studentWithDecimalStrings);

      const s = await service.getById('stu-uuid-1');

      expect(s.invoices[0].amount).toBe(1610);
      expect(s.payments[0].amount).toBe(1000);
      expect(s.billing.currentBalance).toBe(610);
    });

    it('should tolerate students without invoices/payments', async () => {
      (repo.findAllFiltered as any).mockResolvedValue([{ ...FOUND_STUDENT }]);
      (repo.countFiltered as any).mockResolvedValue(1);

      const { data } = await service.getFilteredPaginated({}, 0, 50);

      expect(data[0].invoices).toEqual([]);
      expect(data[0].payments).toEqual([]);
    });
  });
});
