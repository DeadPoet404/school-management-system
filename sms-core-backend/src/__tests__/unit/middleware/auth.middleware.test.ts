import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authenticate, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { AppError } from '@/middleware/error.handler';

const SECRET = process.env.JWT_SECRET!;

function createToken(payload: object, expired = false) {
  const data = { ...payload } as any;
  if (expired) data.exp = Math.floor(Date.now() / 1000) - 3600;
  return jwt.sign(data, SECRET, expired ? {} : { expiresIn: '1h' });
}

function getAppError(next: any): AppError {
  return next.mock.calls[0][0] as AppError;
}

describe('authenticate middleware', () => {
  let res: any;
  let next: any;

  beforeEach(() => {
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  it('should return 401 if no Authorization header', () => {
    const req = { headers: {} } as AuthenticatedRequest;
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(getAppError(next).statusCode).toBe(401);
  });

  it('should return 401 if not Bearer scheme', () => {
    const req = { headers: { authorization: 'Basic abc123' } } as any;
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(getAppError(next).statusCode).toBe(401);
  });

  it('should return 401 for invalid token', () => {
    const req = { headers: { authorization: 'Bearer garbage' } } as any;
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(getAppError(next).statusCode).toBe(401);
  });

  it('should return 401 for expired token', () => {
    const payload = { sub: 'id', email: 'a@b.com', role: 'STUDENT', entityType: 'STUDENT', entityInternalId: 'x' };
    const token = createToken(payload, true);
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(getAppError(next).statusCode).toBe(401);
  });

  it('should set req.user and call next() for valid token', () => {
    const payload = { sub: 'uuid-1', email: 't@t.com', role: 'FACULTY', entityType: 'TEACHER', entityInternalId: 'int-1' };
    const token = createToken(payload);
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthenticatedRequest;
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject(payload);
  });
});
