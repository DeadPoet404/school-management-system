/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use any for flexibility */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authenticate, AuthenticatedRequest } from '@/middleware/auth.middleware';
import { AppError } from '@/middleware/error.handler';

const SECRET = process.env.JWT_SECRET!;

function createToken(payload: object, expired = false) {
  const data = { ...payload } as any;
  if (expired) data.exp = Math.floor(Date.now() / 1000) - 3600;
  return jwt.sign(data, SECRET, expired ? {} : { expiresIn: '15m' });
}

function getAppError(next: any): AppError {
  return next.mock.calls[0][0] as AppError;
}

function mockReq(cookies?: Record<string, string>): AuthenticatedRequest {
  return {
    cookies,
    headers: {},
  } as unknown as AuthenticatedRequest;
}

describe('authenticate middleware (cookie-based)', () => {
  let res: any;
  let next: any;
  let originalSecret: string | undefined;

  beforeEach(() => {
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
    originalSecret = process.env.JWT_SECRET;
  });

  afterEach(() => {
    // Restore JWT_SECRET if a test deleted it
    if (process.env.JWT_SECRET !== originalSecret) {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  // ── Path 1: No access_token cookie ──
  it('should return 401 when no cookies object exists', () => {
    const req = mockReq(undefined);
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = getAppError(next);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Authentication required. No access token cookie.');
  });

  it('should return 401 when access_token cookie is missing', () => {
    const req = mockReq({ someOtherCookie: 'value' });
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = getAppError(next);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Authentication required. No access token cookie.');
  });

  it('should return 401 when access_token cookie is empty string', () => {
    const req = mockReq({ access_token: '' });
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = getAppError(next);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Authentication required. No access token cookie.');
  });

  // ── Path 2: Missing JWT_SECRET env var ──
  it('should return 500 when JWT_SECRET is not configured', () => {
    delete process.env.JWT_SECRET;
    const payload = { sub: 'id', email: 'a@b.com', role: 'STUDENT', entityType: 'STUDENT', entityInternalId: 'x' };
    const token = createToken(payload);
    const req = mockReq({ access_token: token });
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = getAppError(next);
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('Authentication service is not configured.');
  });

  // ── Path 3: Invalid token ──
  it('should return 401 for malformed token', () => {
    const req = mockReq({ access_token: 'not-a-jwt' });
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = getAppError(next);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Invalid token. Please log in again.');
  });

  it('should return 401 for token signed with wrong secret', () => {
    const payload = { sub: 'id', email: 'a@b.com', role: 'STUDENT', entityType: 'STUDENT', entityInternalId: 'x' };
    const token = jwt.sign(payload, 'wrong-secret', { expiresIn: '15m' });
    const req = mockReq({ access_token: token });
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = getAppError(next);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Invalid token. Please log in again.');
  });

  // ── Path 4: Expired token — specific message for frontend refresh ──
  it('should return 401 with ACCESS_TOKEN_EXPIRED message for expired token', () => {
    const payload = { sub: 'id', email: 'a@b.com', role: 'STUDENT', entityType: 'STUDENT', entityInternalId: 'x' };
    const token = createToken(payload, true);
    const req = mockReq({ access_token: token });
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = getAppError(next);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('ACCESS_TOKEN_EXPIRED');
  });

  // ── Path 5: Valid token ──
  it('should set req.user and call next() for valid STUDENT token', () => {
    const payload = { sub: 'uuid-1', email: 'student@school.com', role: 'STUDENT', entityType: 'STUDENT', entityInternalId: 'int-1' };
    const token = createToken(payload);
    const req = mockReq({ access_token: token });
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject(payload);
  });

  it('should set req.user and call next() for valid FACULTY token', () => {
    const payload = { sub: 'uuid-2', email: 'teacher@school.com', role: 'FACULTY', entityType: 'TEACHER', entityInternalId: 'int-2' };
    const token = createToken(payload);
    const req = mockReq({ access_token: token });
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject(payload);
  });

  it('should set req.user and call next() for valid STAFF token', () => {
    const payload = { sub: 'uuid-3', email: 'admin@school.com', role: 'ADMIN', entityType: 'STAFF', entityInternalId: 'int-3' };
    const token = createToken(payload);
    const req = mockReq({ access_token: token });
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject(payload);
  });
});
