/* eslint-disable @typescript-eslint/no-explicit-any -- Express error handler must accept unknown error shapes */
import { Request, Response, NextFunction } from 'express';
import { logger } from '@/lib/logger';

// ── CUSTOM APPLICATION ERROR CLASS ──
// We'll use this later to throw specific HTTP errors (e.g., throw new AppError(404, "Not found"))
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintain proper stack trace in V8 environments
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ── GLOBAL ERROR INTERCEPTOR ──
// Must have exactly 4 parameters to be recognized by Express as an error handler
export const globalErrorHandler = (
  err: Error | AppError | any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 1. Default fallbacks for unknown errors
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // 2. Development vs Production error responses
  if (process.env.NODE_ENV === 'development') {
    // DEV: Send full details for debugging
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      stack: err.stack,
      error: err,
    });
  } else {
    // PROD: Hide internal details from the client
    
    // Handle known Prisma errors safely
    if (err.code === 'P2002') {
      // Unique constraint violation
      const field = (err.meta?.target as string[])?.join(', ') || 'field';
      return res.status(409).json({
        success: false,
        message: `A record with this ${field} already exists.`,
      });
    }

    if (err.code === 'P2025') {
      // Record not found
      return res.status(404).json({
        success: false,
        message: 'The requested record was not found.',
      });
    }

    if (err.code === 'P2003') {
      // Foreign key constraint failed
      return res.status(400).json({
        success: false,
        message: 'Invalid reference provided. Related record does not exist.',
      });
    }

    // Operational errors (thrown by us) are safe to show
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }

    // Unknown programming errors -> log via Pino, send generic message
    logger.error(err, 'UNEXPECTED ERROR');
    
    res.status(500).json({
      success: false,
      message: 'An unexpected internal server error occurred.',
    });
  }
};
