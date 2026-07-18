/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use any for flexibility */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppError, globalErrorHandler } from '@/middleware/error.handler';
import { Request, Response, NextFunction } from 'express';
import { logger } from '@/lib/logger';

// Mock Pino logger so we can assert on logger.error calls
// without producing real log output during tests
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

function mockRes(): Response {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
}

describe('AppError', () => {
  it('should set statusCode, message, and default isOperational to true', () => {
    const err = new AppError(404, 'Not found');
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.isOperational).toBe(true);
  });

  it('should allow overriding isOperational to false', () => {
    const err = new AppError(500, 'Crash', false);
    expect(err.isOperational).toBe(false);
  });
});

describe('globalErrorHandler', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  // ── Development mode ──
  describe('development mode', () => {
    beforeEach(() => { process.env.NODE_ENV = 'development'; });

    it('should return full error details for AppError', () => {
      const err = new AppError(400, 'Bad input');
      const res = mockRes();
      globalErrorHandler(err, {} as Request, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Bad input',
          stack: expect.any(String),
        })
      );
    });

    it('should return full error details for unknown errors', () => {
      const err = new Error('something broke');
      const res = mockRes();
      globalErrorHandler(err, {} as Request, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          stack: expect.any(String),
          error: err,
        })
      );
    });
  });

  // ── Production mode ──
  describe('production mode', () => {
    beforeEach(() => { process.env.NODE_ENV = 'production'; });

    it('should return only message for operational AppError', () => {
      const err = new AppError(409, 'Conflict');
      const res = mockRes();
      globalErrorHandler(err, {} as Request, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Conflict',
      });
    });

    it('should map P2002 to 409 with field name', () => {
      const err = new Error('Unique constraint') as any;
      err.code = 'P2002';
      err.meta = { target: ['portalEmail'] };
      const res = mockRes();
      globalErrorHandler(err, {} as Request, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'A record with this portalEmail already exists.',
      });
    });

    it('should map P2002 without meta target to generic message', () => {
      const err = new Error('Unique constraint') as any;
      err.code = 'P2002';
      err.meta = {};
      const res = mockRes();
      globalErrorHandler(err, {} as Request, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'A record with this field already exists.',
      });
    });

    it('should map P2025 to 404', () => {
      const err = new Error('Not found') as any;
      err.code = 'P2025';
      const res = mockRes();
      globalErrorHandler(err, {} as Request, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'The requested record was not found.',
      });
    });

    it('should map P2003 to 400', () => {
      const err = new Error('FK violation') as any;
      err.code = 'P2003';
      const res = mockRes();
      globalErrorHandler(err, {} as Request, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid reference provided. Related record does not exist.',
      });
    });

    it('should log via Pino and return generic 500 for unknown non-operational errors', () => {
      const err = new Error('secret leak') as any;
      err.isOperational = false;
      const res = mockRes();
      globalErrorHandler(err, {} as Request, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An unexpected internal server error occurred.',
      });
      // Pino signature: logger.error(err, message)
      expect(logger.error).toHaveBeenCalledWith(err, 'UNEXPECTED ERROR');
    });
  });
});
