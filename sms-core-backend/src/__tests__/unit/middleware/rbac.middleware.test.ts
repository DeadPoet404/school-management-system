import { describe, it, expect, vi } from 'vitest';
import { requireRole, ROLES } from '@/middleware/rbac.middleware';
import { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { AppError } from '@/middleware/error.handler';

function mockRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

describe('requireRole middleware', () => {
  it('should return 401 if no user on request', () => {
    const middleware = requireRole(ROLES.ADMIN);
    const next = vi.fn();
    middleware({} as AuthenticatedRequest, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401);
  });

  it('should return 403 if user role not allowed', () => {
    const middleware = requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT);
    const next = vi.fn();
    middleware({ user: { role: 'STUDENT' } } as AuthenticatedRequest, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(403);
  });

  it('should call next() with no args if role is allowed', () => {
    const middleware = requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT);
    const next = vi.fn();
    middleware({ user: { role: 'ADMIN' } } as AuthenticatedRequest, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should accept any role in the allowed list', () => {
    const middleware = requireRole(ROLES.STAFF, ROLES.FACULTY, ROLES.ADMIN);
    const next = vi.fn();
    for (const role of [ROLES.STAFF, ROLES.FACULTY, ROLES.ADMIN]) {
      next.mockClear();
      middleware({ user: { role } } as AuthenticatedRequest, mockRes(), next);
      expect(next).toHaveBeenCalledWith();
    }
  });

  it('should reject similar but different role', () => {
    const middleware = requireRole(ROLES.STAFF, ROLES.FACULTY);
    const next = vi.fn();
    middleware({ user: { role: 'ACCOUNTANT' } } as AuthenticatedRequest, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(403);
  });
});
