import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.handler';
import { JwtPayload } from '@/types/auth.types';

// Extended request type for authenticated routes
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * JWT authentication middleware.
 * Extracts Bearer token from Authorization header, verifies it,
 * and attaches the decoded payload to req.user.
 */
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'Authentication required. Provide a valid Bearer token.'));
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next(new AppError(401, 'Authentication required. Provide a valid Bearer token.'));
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new AppError(500, 'Authentication service is not configured.'));
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'Token has expired. Please log in again.'));
    }
    return next(new AppError(401, 'Invalid token. Please log in again.'));
  }
}
