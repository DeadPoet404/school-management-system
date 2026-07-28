import { describe, it, expect } from 'vitest';
import { assertSelfOrPrivilegedStudentAccess } from '@/middleware/self-access';
import { JwtPayload } from '@/types/auth.types';
import { AppError } from '@/middleware/error.handler';

function studentUser(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'acc-stu-1',
    email: 'student@school.com',
    role: 'STUDENT',
    entityType: 'STUDENT',
    entityInternalId: 'stu-internal-1',
    ...overrides,
  };
}

function facultyUser(): JwtPayload {
  return {
    sub: 'acc-tch-1',
    email: 'teacher@school.com',
    role: 'FACULTY',
    entityType: 'TEACHER',
    entityInternalId: 'tch-internal-1',
  };
}

function adminUser(): JwtPayload {
  return {
    sub: 'acc-admin-1',
    email: 'admin@school.com',
    role: 'ADMIN',
    entityType: 'STAFF',
    entityInternalId: 'staff-internal-1',
  };
}

function expectAppError(fn: () => void, statusCode: number, message?: string) {
  try {
    fn();
    throw new Error('Expected AppError to be thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject(
      message ? { statusCode, message } : { statusCode },
    );
  }
}

describe('assertSelfOrPrivilegedStudentAccess', () => {
  it('throws 401 when user is missing', () => {
    expectAppError(
      () => assertSelfOrPrivilegedStudentAccess(undefined, 'stu-internal-1'),
      401,
    );
  });

  it('allows a STUDENT to read their own entityInternalId', () => {
    expect(() =>
      assertSelfOrPrivilegedStudentAccess(studentUser(), 'stu-internal-1'),
    ).not.toThrow();
  });

  it('rejects a STUDENT reading another student id (IDOR)', () => {
    expectAppError(
      () =>
        assertSelfOrPrivilegedStudentAccess(studentUser(), 'stu-internal-OTHER'),
      403,
      'You can only access your own records.',
    );
  });

  it('rejects a STUDENT when requested id is empty', () => {
    expectAppError(
      () => assertSelfOrPrivilegedStudentAccess(studentUser(), ''),
      403,
    );
  });

  it('allows FACULTY to read any student id', () => {
    expect(() =>
      assertSelfOrPrivilegedStudentAccess(facultyUser(), 'stu-internal-OTHER'),
    ).not.toThrow();
  });

  it('allows ADMIN to read any student id', () => {
    expect(() =>
      assertSelfOrPrivilegedStudentAccess(adminUser(), 'stu-internal-OTHER'),
    ).not.toThrow();
  });

  it('allows STAFF to read any student id', () => {
    const staff: JwtPayload = {
      sub: 'acc-staff-1',
      email: 'staff@school.com',
      role: 'STAFF',
      entityType: 'STAFF',
      entityInternalId: 'staff-internal-1',
    };
    expect(() =>
      assertSelfOrPrivilegedStudentAccess(staff, 'stu-internal-OTHER'),
    ).not.toThrow();
  });
});
