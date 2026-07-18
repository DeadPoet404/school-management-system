import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.handler';
import { JwtPayload } from '@/types/auth.types';
import { isTokenBlocked, isUserInvalidated } from '@/lib/token-blocklist';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * JWT authentication middleware.
 * P1: Reads access_token from httpOnly cookie (migrated from Authorization header).
 * B-4 fix: Explicitly specifies algorithms to prevent alg:none attacks.
 */
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.access_token;

  if (!token) {
    return next(new AppError(401, 'Authentication required. No access token cookie.'));
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new AppError(500, 'Authentication service is not configured.'));
  }

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;

    // Reject tokens that have been explicitly blocked (e.g., logout)
    if (isTokenBlocked(token)) {
      return next(new AppError(401, 'Token has been revoked.'));
    }

    // Reject tokens issued before a user-level invalidation (e.g., password change)
    if (isUserInvalidated(decoded.sub, decoded.iat)) {
      return next(new AppError(401, 'Session has been invalidated. Please log in again.'));
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      // Specific message so frontend can trigger token refresh
      return next(new AppError(401, 'ACCESS_TOKEN_EXPIRED'));
    }
    return next(new AppError(401, 'Invalid token. Please log in again.'));
  }
}
