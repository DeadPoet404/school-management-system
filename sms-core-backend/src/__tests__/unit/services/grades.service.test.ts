/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use any for flexibility */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    subject: { findUnique: vi.fn() },
    class: { findUnique: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { GradesService } from '@/modules/grades/grades.service';

describe('GradesService faculty allocation (PR2 canonical Class.id)', () => {
  const repo = {
    upsertGradeRecord: vi.fn(),
    getAllStudentGrades: vi.fn(),
    updateStudentGpa: vi.fn(),
    findTeacherAllocation: vi.fn(),
  };

  let service: GradesService;

  const facultyUser = {
    sub: 'acc-tch-1',
    email: 'teacher@school.com',
    role: 'FACULTY',
    entityType: 'TEACHER' as const,
    entityInternalId: 'tch-internal-1',
  };

  const payload = {
    studentId: 'stu-1',
    subjectId: 'sub-math',
    classId: 'class-uuid-jhs1a',
    termId: 'term-1',
    continuousAssessment: 20,
    examination: 50,
  };

  beforeEach(() => {
    service = new GradesService(repo as any);
    vi.clearAllMocks();
    (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(prisma));
    (prisma.subject.findUnique as any).mockResolvedValue({ id: 'sub-math', name: 'Mathematics' });
    (prisma.class.findUnique as any).mockResolvedValue({
      id: 'class-uuid-jhs1a',
      name: 'JHS 1A',
      section: 'A',
    });
    repo.getAllStudentGrades.mockResolvedValue([]);
    repo.upsertGradeRecord.mockResolvedValue({ id: 'grade-1', ...payload });
  });

  it('looks up teacher allocation with Class.id, not Class.section letter', async () => {
    repo.findTeacherAllocation.mockResolvedValue(true);

    await service.submitStudentMark(payload, facultyUser);

    expect(repo.findTeacherAllocation).toHaveBeenCalledWith(
      'tch-internal-1',
      'Mathematics',
      'class-uuid-jhs1a',
      prisma,
    );
    expect(repo.findTeacherAllocation).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'A',
      expect.anything(),
    );
  });

  it('rejects faculty not allocated to Class.id timetable section', async () => {
    repo.findTeacherAllocation.mockResolvedValue(false);

    await expect(service.submitStudentMark(payload, facultyUser)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('allows ADMIN without allocation check', async () => {
    await service.submitStudentMark(payload, {
      ...facultyUser,
      role: 'ADMIN',
      entityType: 'STAFF',
      entityInternalId: 'staff-1',
    });

    expect(repo.findTeacherAllocation).not.toHaveBeenCalled();
    expect(repo.upsertGradeRecord).toHaveBeenCalled();
  });
});
