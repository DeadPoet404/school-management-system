/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use any for flexibility */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// ── Module mocks (hoisted by vitest) ──
vi.mock('@/lib/prisma', () => ({
  prisma: {
    studentAccount: { findUnique: vi.fn() },
    staffAccount: { findUnique: vi.fn() },
    teacherAccount: { findUnique: vi.fn() },
    refreshToken: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/utils/hash', () => ({
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { comparePassword } from '@/utils/hash';
import { AuthService } from '@/modules/auth/auth.service';

const mockedComparePassword = vi.mocked(comparePassword);

// ── Test fixtures ──
const STUDENT_ACCOUNT = {
  id: 'acc-stu-1',
  portalEmail: 'student@school.com',
  passwordHash: 'hashed-pw',
  student: { id: 'stu-internal-1', status: 'ACTIVE' },
};

const STAFF_ACCOUNT = {
  id: 'acc-staff-1',
  email: 'staff@school.com',
  passwordHash: 'hashed-pw',
  role: 'ADMIN',
  staff: { id: 'staff-internal-1', status: 'ACTIVE' },
};

const TEACHER_ACCOUNT = {
  id: 'acc-tch-1',
  email: 'teacher@school.com',
  passwordHash: 'hashed-pw',
  role: 'FACULTY',
  teacher: { id: 'tch-internal-1', status: 'ACTIVE' },
};

const DEPARTED_STUDENT = {
  ...STUDENT_ACCOUNT,
  student: { id: 'stu-departed', status: 'DEPARTED' },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.clearAllMocks();

    // Ensure secrets are set (setup.ts sets JWT_SECRET but not refresh)
    process.env.JWT_SECRET = 'test-access-secret-key-that-is-long-enough';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-that-is-long';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    // Default: no accounts found
    (prisma.studentAccount.findUnique as any).mockResolvedValue(null);
    (prisma.staffAccount.findUnique as any).mockResolvedValue(null);
    (prisma.teacherAccount.findUnique as any).mockResolvedValue(null);
    // Default: refresh token create succeeds
    (prisma.refreshToken.create as any).mockResolvedValue({ id: 'rt-new' });
  });

  // ── LOGIN ──
  describe('login', () => {
    it('should throw 401 when no account found for email', async () => {
      await expect(service.login('nobody@school.com', 'pw')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    });

    it('should throw 401 when password is incorrect', async () => {
      (prisma.studentAccount.findUnique as any).mockResolvedValue(STUDENT_ACCOUNT);
      mockedComparePassword.mockResolvedValue(false);

      await expect(service.login('student@school.com', 'wrong')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('should throw 403 when account status is DEPARTED', async () => {
      (prisma.studentAccount.findUnique as any).mockResolvedValue(DEPARTED_STUDENT);
      mockedComparePassword.mockResolvedValue(true);

      await expect(service.login('student@school.com', 'pw')).rejects.toMatchObject({
        statusCode: 403,
        message: 'Account is inactive. Contact administration.',
      });
    });

    it('should return tokens for valid STUDENT account', async () => {
      (prisma.studentAccount.findUnique as any).mockResolvedValue(STUDENT_ACCOUNT);
      mockedComparePassword.mockResolvedValue(true);

      const result = await service.login('student@school.com', 'pw');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('student@school.com');
      expect(result.user.role).toBe('STUDENT');
      expect(result.user.entityType).toBe('STUDENT');

      // Verify access token decodes correctly
      const decoded = jwt.verify(result.accessToken, process.env.JWT_SECRET!);
      expect(decoded).toMatchObject({ sub: 'acc-stu-1', role: 'STUDENT', entityType: 'STUDENT' });

      // Verify refresh token was stored in DB
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            token: result.refreshToken,
            accountId: 'acc-stu-1',
            accountType: 'STUDENT',
            userId: 'stu-internal-1',
          }),
        })
      );
    });

    it('should return tokens for valid STAFF account with correct role', async () => {
      (prisma.staffAccount.findUnique as any).mockResolvedValue(STAFF_ACCOUNT);
      mockedComparePassword.mockResolvedValue(true);

      const result = await service.login('staff@school.com', 'pw');
      expect(result.user.role).toBe('ADMIN');
      expect(result.user.entityType).toBe('STAFF');

      const decoded = jwt.verify(result.accessToken, process.env.JWT_SECRET!);
      expect(decoded).toMatchObject({ sub: 'acc-staff-1', role: 'ADMIN', entityType: 'STAFF' });
    });

    it('should return tokens for valid TEACHER account', async () => {
      (prisma.teacherAccount.findUnique as any).mockResolvedValue(TEACHER_ACCOUNT);
      mockedComparePassword.mockResolvedValue(true);

      const result = await service.login('teacher@school.com', 'pw');
      expect(result.user.role).toBe('FACULTY');
      expect(result.user.entityType).toBe('TEACHER');

      const decoded = jwt.verify(result.accessToken, process.env.JWT_SECRET!);
      expect(decoded).toMatchObject({ sub: 'acc-tch-1', role: 'FACULTY', entityType: 'TEACHER' });
    });
  });

  // ── REFRESH ──
  describe('refresh', () => {
    it('should throw 401 for malformed token', async () => {
      await expect(service.refresh('not-a-jwt')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid refresh token. Please log in again.',
      });
    });

    it('should throw 401 with specific message for expired token', async () => {
      const expiredToken = jwt.sign(
        { sub: 'id', email: 'a@b.com', role: 'STUDENT', entityType: 'STUDENT', entityInternalId: 'x' },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '-1s' }
      );
      await expect(service.refresh(expiredToken)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Refresh token has expired. Please log in again.',
      });
    });

    it('should throw 401 when token not found in DB', async () => {
      const validToken = jwt.sign(
        { sub: 'id', email: 'a@b.com', role: 'STUDENT', entityType: 'STUDENT', entityInternalId: 'x' },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '7d' }
      );
      (prisma.refreshToken.findUnique as any).mockResolvedValue(null);

      await expect(service.refresh(validToken)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid refresh token. Please log in again.',
      });
    });

    it('should throw 401 when token is revoked', async () => {
      const validToken = jwt.sign(
        { sub: 'id', email: 'a@b.com', role: 'STUDENT', entityType: 'STUDENT', entityInternalId: 'x' },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '7d' }
      );
      (prisma.refreshToken.findUnique as any).mockResolvedValue({
        id: 'rt-1',
        token: validToken,
        revokedAt: new Date(),
      });

      await expect(service.refresh(validToken)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid refresh token. Please log in again.',
      });
    });

    it('should rotate token and return new pair', async () => {
      const validToken = jwt.sign(
        { sub: 'id', email: 'a@b.com', role: 'ADMIN', entityType: 'STAFF', entityInternalId: 'staff-1' },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '7d' }
      );
      (prisma.refreshToken.findUnique as any).mockResolvedValue({
        id: 'rt-old',
        token: validToken,
        revokedAt: null,
      });
      (prisma.refreshToken.delete as any).mockResolvedValue({});

      const result = await service.refresh(validToken);

      // Old token was deleted (rotation)
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-old' } });

      // New tokens issued
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.role).toBe('ADMIN');

      // New refresh token stored in DB
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });
  });

  // ── LOGOUT ──
  describe('logout', () => {
    it('should call deleteMany with the token', async () => {
      (prisma.refreshToken.deleteMany as any).mockResolvedValue({ count: 1 });
      await service.logout('some-refresh-token');
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'some-refresh-token' },
      });
    });

    it('should return early when no token provided', async () => {
      await service.logout('');
      expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ── ME ──
  describe('me', () => {
    it('should return payload fields without DB call', async () => {
      const payload = {
        sub: 'uuid-1',
        email: 'admin@school.com',
        role: 'ADMIN',
        entityType: 'STAFF' as const,
        entityInternalId: 'staff-id-1',
      };
      const result = await service.me(payload);
      expect(result).toEqual({
        email: 'admin@school.com',
        role: 'ADMIN',
        entityType: 'STAFF',
        entityInternalId: 'staff-id-1',
      });
    });
  });
});
