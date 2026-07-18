import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/middleware/error.handler';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    feeTier: { findUnique: vi.fn() },
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
    (prisma.feeTier.findUnique as any).mockResolvedValue({ code: 'TIER-A', amount: '2000' });
  });

  // ── getById ──
  describe('getById', () => {
    it('should throw 404 when student not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getById('nonexistent')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Student not found with ID: nonexistent',
      });
    });

    it('should return student when found', async () => {
      repo.findById.mockResolvedValue(FOUND_STUDENT);
      const result = await service.getById('stu-uuid-1');
      expect(result).toBe(FOUND_STUDENT);
      expect(repo.findById).toHaveBeenCalledWith('stu-uuid-1');
    });
  });

  // ── getFilteredPaginated ──
  describe('getFilteredPaginated', () => {
    it('should call findAllFiltered and countFiltered with empty filters', async () => {
      repo.findAllFiltered.mockResolvedValue([FOUND_STUDENT]);
      repo.countFiltered.mockResolvedValue(1);

      const result = await service.getFilteredPaginated({}, 0, 20);

      expect(repo.findAllFiltered).toHaveBeenCalledTimes(1);
      expect(repo.countFiltered).toHaveBeenCalledTimes(1);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass search filter to findAllFiltered', async () => {
      repo.findAllFiltered.mockResolvedValue([]);
      repo.countFiltered.mockResolvedValue(0);

      await service.getFilteredPaginated({ search: 'john' }, 0, 20);

      const whereArg = (repo.findAllFiltered as any).mock.calls[0][0];
      expect(whereArg.OR).toBeDefined();
      expect(whereArg.OR[0].studentName.contains).toBe('john');
    });

    it('should pass status filter directly', async () => {
      repo.findAllFiltered.mockResolvedValue([]);
      repo.countFiltered.mockResolvedValue(0);

      await service.getFilteredPaginated({ status: 'DEPARTED' }, 0, 20);

      const whereArg = (repo.findAllFiltered as any).mock.calls[0][0];
      expect(whereArg.status).toBe('DEPARTED');
    });
  });

  // ── update ──
  describe('update', () => {
    it('should throw 404 when student not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update('nonexistent', { studentName: 'X' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 409 when student is departed', async () => {
      repo.findById.mockResolvedValue(DEPARTED_STUDENT);
      await expect(service.update('stu-uuid-1', { studentName: 'X' })).rejects.toMatchObject({
        statusCode: 409,
        message: 'Cannot update a departed student.',
      });
    });

    it('should convert dateOfBirth string to Date before passing to repo', async () => {
      repo.findById.mockResolvedValue(FOUND_STUDENT);
      repo.update.mockResolvedValue(FOUND_STUDENT);

      await service.update('stu-uuid-1', {
        demographics: { dateOfBirth: '2010-05-20' },
      });

      const updateArg = (repo.update as any).mock.calls[0][1];
      expect(updateArg.demographics.dateOfBirth).toBeInstanceOf(Date);
    });

    it('should call repo.update with id and payload', async () => {
      repo.findById.mockResolvedValue(FOUND_STUDENT);
      repo.update.mockResolvedValue(FOUND_STUDENT);

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
      repo.findByPublicId.mockResolvedValue(null);
      await expect(service.processDeparture(DEPARTURE_PAYLOAD)).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('STU-DEPT-abc123'),
      });
    });

    it('should throw 409 when student already departed', async () => {
      repo.findByPublicId.mockResolvedValue(DEPARTED_STUDENT);
      await expect(service.processDeparture(DEPARTURE_PAYLOAD)).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('already been processed'),
      });
    });

    it('should create departure log and update status to DEPARTED', async () => {
      repo.findByPublicId.mockResolvedValue(FOUND_STUDENT);
      repo.createDepartureLog.mockResolvedValue({ id: 'dep-1' });
      repo.updateStatus.mockResolvedValue({});

      const result = await service.processDeparture(DEPARTURE_PAYLOAD);

      expect(repo.createDepartureLog).toHaveBeenCalledTimes(1);
      expect(repo.updateStatus).toHaveBeenCalledWith('stu-uuid-1', 'DEPARTED', expect.anything());
      expect(result).toEqual({ id: 'dep-1' });
    });
  });

  // ── createStudent ──
  describe('createStudent', () => {
    it('should throw 400 when neither guardian nor parent provided', async () => {
      const payload = { ...VALID_ENROLLMENT_PAYLOAD };
      delete payload.guardian;
      await expect(service.createStudent(payload as any)).rejects.toMatchObject({
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
      repo.createNestedStudent.mockResolvedValue({ id: 'new-1', studentId: 'STU-X', studentName: 'Jane' });

      const payload = { ...VALID_ENROLLMENT_PAYLOAD, guardian: undefined, parent: VALID_ENROLLMENT_PAYLOAD.guardian };
      const result = await service.createStudent(payload);

      expect(repo.createNestedStudent).toHaveBeenCalledTimes(1);
      expect(result.studentName).toBe('Jane');
    });

    it('should calculate balance as feeTier amount minus initial deposit', async () => {
      (prisma.feeTier.findUnique as any).mockResolvedValue({ code: 'TIER-A', amount: '2000' });
      repo.createNestedStudent.mockResolvedValue({ id: 'new-1', studentId: 'STU-X', studentName: 'Jane' });

      await service.createStudent({
        ...VALID_ENROLLMENT_PAYLOAD,
        billing: { feeTierId: 'TIER-A', initialDeposit: 500 },
      });

      const createData = (repo.createNestedStudent as any).mock.calls[0][0];
      expect(createData.billing.create.currentBalance).toBe(1500);
    });

    it('should handle missing feeTier gracefully (balance = full deposit)', async () => {
      (prisma.feeTier.findUnique as any).mockResolvedValue(null);
      repo.createNestedStudent.mockResolvedValue({ id: 'new-1', studentId: 'STU-X', studentName: 'Jane' });

      await service.createStudent({
        ...VALID_ENROLLMENT_PAYLOAD,
        billing: { feeTierId: 'UNKNOWN', initialDeposit: 500 },
      });

      const createData = (repo.createNestedStudent as any).mock.calls[0][0];
      expect(createData.billing.create.currentBalance).toBe(0);
    });
  });

  // ── getFinancialMatrix ──
  describe('getFinancialMatrix', () => {
    it('should aggregate invoice and payment totals per student', async () => {
      repo.findWithFinancialData.mockResolvedValue([
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
      expect(result[0].amountPaid).toBe(1500);
      expect(result[0].balanceRemaining).toBe(500);
      expect(result[0].feesStatus).toBe('Partial');
      // Student s2: no invoices, no payments → Unpaid
      expect(result[1].amountPaid).toBe(0);
      expect(result[1].feesStatus).toBe('Unpaid');
    });

    it('should mark as Paid when balance is 0 and payments exist', async () => {
      repo.findWithFinancialData.mockResolvedValue([
        { id: 's1', studentId: 'STU-1', studentName: 'A', status: 'ACTIVE', account: {}, invoices: [{ invoiceNo: 'INV-1', amount: '1000', createdAt: new Date() }], payments: [{ receiptNo: 'PAY-1', amount: '1000', paymentType: 'Cash', createdAt: new Date() }] },
      ]);
      (prisma.invoice.groupBy as any).mockResolvedValue([{ studentId: 's1', _sum: { amount: '1000' } }]);
      (prisma.payment.groupBy as any).mockResolvedValue([{ studentId: 's1', _sum: { amount: '1000' } }]);

      const result = await service.getFinancialMatrix();
      expect(result[0].feesStatus).toBe('Paid');
      expect(result[0].lastTransactionId).toBe('PAY-1');
    });
  });
});
