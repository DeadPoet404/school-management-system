/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use any for flexibility */
/**
 * SMS-002 regression — teacher onboarding must persist the employment date
 * captured by the add-teacher form (account.employmentDate). Before this fix
 * the controller dropped the field and the service never wrote it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teacherAccount: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/utils/hash', () => ({
  hashPassword: vi.fn().mockResolvedValue('$hashed$'),
}));

import { prisma } from '@/lib/prisma';
import { TeacherService } from '@/modules/teachers/teacher.service';
import { createMockTeacherRepo } from '@/__tests__/helpers/mock-repositories';

const CREATED_TEACHER = {
  id: 'teacher-uuid-1',
  teacherId: 'TCH-SCI-abc123',
  teacherName: 'Ama Mensah',
};

const VALID_ONBOARDING_PAYLOAD = {
  account: {
    fullName: 'Ama Mensah',
    email: 'ama.mensah@school.edu.gh',
    password: 'temp-pass-123',
    employmentDate: '2026-01-15',
  },
  demographics: {
    gender: 'Female',
    dateOfBirth: '1990-04-12',
    phone: '0244123456',
    residentialAddress: '12 Independence Avenue, Accra',
  },
};

describe('SMS-002: TeacherService.createTeacher persists employmentDate', () => {
  let repo: ReturnType<typeof createMockTeacherRepo>;
  let service: TeacherService;

  beforeEach(() => {
    repo = createMockTeacherRepo();
    service = new TeacherService(repo);
    vi.clearAllMocks();

    (repo.createNestedTeacher as any).mockResolvedValue(CREATED_TEACHER);

    (prisma.teacherAccount.create as any).mockResolvedValue({
      id: 'account-uuid-1',
    });
  });

  it('writes account.employmentDate to the Teacher record as a Date', async () => {
    await service.createTeacher(VALID_ONBOARDING_PAYLOAD);

    expect(repo.createNestedTeacher).toHaveBeenCalledTimes(1);
    const dbPayload = (repo.createNestedTeacher as any).mock.calls[0][0];
    expect(dbPayload.employmentDate).toBeInstanceOf(Date);
    expect((dbPayload.employmentDate as Date).getTime()).toBe(new Date('2026-01-15').getTime());
  });

  it('persists null (never a fabricated date) when employmentDate is absent, e.g. import flow', async () => {
    const accountWithoutDate = {
      fullName: VALID_ONBOARDING_PAYLOAD.account.fullName,
      email: VALID_ONBOARDING_PAYLOAD.account.email,
      password: VALID_ONBOARDING_PAYLOAD.account.password,
    };
    await service.createTeacher({ ...VALID_ONBOARDING_PAYLOAD, account: accountWithoutDate });

    const dbPayload = (repo.createNestedTeacher as any).mock.calls[0][0];
    expect(dbPayload.employmentDate).toBeNull();
  });
});
