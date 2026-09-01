/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma test doubles are intentionally partial */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn().mockImplementation(async (operations: unknown[]) => Promise.all(operations)),
    studentAccount: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/utils/hash', () => ({
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock('@/lib/token-blocklist', () => ({
  invalidateUserTokensBefore: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { comparePassword, hashPassword } from '@/utils/hash';
import { invalidateUserTokensBefore } from '@/lib/token-blocklist';
import { AuthService } from '@/modules/auth/auth.service';
import type { JwtPayload } from '@/types/auth.types';

const payload: JwtPayload = {
  sub: 'account-1',
  email: 'student@school.com',
  role: 'STUDENT',
  entityType: 'STUDENT',
  entityInternalId: 'student-1',
  mustChangePassword: false,
};

const account = {
  id: 'account-1',
  portalEmail: 'student@school.com',
  passwordHash: 'old-hash',
  mustChangePassword: false,
  passwordChangedAt: null,
  student: {
    id: 'student-1',
    studentId: 'JCS0001',
    studentName: 'Test Student',
    status: 'ACTIVE',
  },
};

describe('AuthService password lifecycle', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService();
    (prisma.studentAccount.update as any).mockResolvedValue(account);
    (prisma.refreshToken.deleteMany as any).mockResolvedValue({ count: 2 });
    vi.mocked(hashPassword).mockResolvedValue('new-hash');
  });

  it('rejects an incorrect current password', async () => {
    (prisma.studentAccount.findUnique as any).mockResolvedValue(account);
    vi.mocked(comparePassword).mockResolvedValue(false);

    await expect(
      service.changeStudentPassword(payload, 'wrong-password', 'A-new-password-2026'),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Current password is incorrect.',
    });

    expect(prisma.studentAccount.update).not.toHaveBeenCalled();
  });

  it('rejects reuse of the current password', async () => {
    (prisma.studentAccount.findUnique as any).mockResolvedValue(account);
    vi.mocked(comparePassword)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await expect(
      service.changeStudentPassword(payload, 'current-password', 'current-password'),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'New password must be different from the current password.',
    });
  });

  it('changes the password, clears forced-change state, and revokes sessions', async () => {
    (prisma.studentAccount.findUnique as any).mockResolvedValue(account);
    vi.mocked(comparePassword)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await service.changeStudentPassword(
      payload,
      'current-password',
      'A-new-password-2026',
    );

    expect(hashPassword).toHaveBeenCalledWith('A-new-password-2026');
    expect(prisma.studentAccount.update).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: expect.objectContaining({
        passwordHash: 'new-hash',
        mustChangePassword: false,
        passwordChangedAt: expect.any(Date),
      }),
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { accountId: 'account-1' },
    });
    expect(invalidateUserTokensBefore).toHaveBeenCalledWith(
      'account-1',
      expect.any(Number),
    );
  });

  it('generates a temporary password and forces change after an admin reset', async () => {
    (prisma.studentAccount.findUnique as any).mockResolvedValue(account);

    const result = await service.resetStudentPassword('student-1');

    expect(result.temporaryPassword).toMatch(/^Jc![A-Za-z0-9_-]{16}$/);
    expect(result.mustChangePassword).toBe(true);
    expect(hashPassword).toHaveBeenCalledWith(result.temporaryPassword);
    expect(prisma.studentAccount.update).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: expect.objectContaining({
        passwordHash: 'new-hash',
        mustChangePassword: true,
        passwordChangedAt: expect.any(Date),
      }),
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { accountId: 'account-1' },
    });
  });

  it('does not disclose whether a missing record had credentials', async () => {
    (prisma.studentAccount.findUnique as any).mockResolvedValue(null);

    await expect(service.resetStudentPassword('missing-student')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Student account not found.',
    });
  });
});
