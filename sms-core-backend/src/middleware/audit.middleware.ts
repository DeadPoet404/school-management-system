import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Audit logging middleware.
 * Captures all write operations (POST, PUT, PATCH, DELETE) and
 * persists them to the AuditLog table asynchronously.
 * Never blocks the response — DB write failure falls back to pino log.
 */
export function auditLog(req: Request, res: Response, next: NextFunction) {
  const method = req.method;

  // Only audit write operations
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return next();
  }

  // Capture the original res.json to intercept the status code
  const originalJson = res.json.bind(res);

  res.json = (body: Prisma.InputJsonValue) => {
    // Fire-and-forget DB write — do not await
    prisma.auditLog
      .create({
        data: {
          requestId: (req as AuthenticatedRequest & { id?: string }).id || 'unknown',
          actorId: (req as AuthenticatedRequest).user?.sub || 'anonymous',
          actorEmail: (req as AuthenticatedRequest).user?.email || 'anonymous',
          actorRole: (req as AuthenticatedRequest).user?.role || 'none',
          action: `${method} ${req.route?.path || req.originalUrl}`,
          method,
          path: req.originalUrl,
          requestBody: sanitizeBody(req.body) as Prisma.InputJsonValue,
          responseStatus: res.statusCode,
          ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        },
      })
      .catch((err) => {
        // Never let audit failure crash the request
        logger.warn({ err, path: req.originalUrl }, 'Audit log write failed');
      });

    return originalJson(body);
  };

  next();
}

/**
 * Strips sensitive fields from request body before storage.
 */
function sanitizeBody(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== "object") return undefined;

  const sensitiveFields = ['password', 'passwordHash', 'token', 'secret'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (sensitiveFields.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeBody(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
