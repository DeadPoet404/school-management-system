import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { AppError } from './error.handler';

export const ROLES = {
  STUDENT: 'STUDENT',
  STAFF: 'STAFF',
  FACULTY: 'FACULTY',
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Role-based access control middleware.
 * Must be used AFTER the authenticate middleware.
 * Checks if req.user.role matches one of the allowed roles.
 *
 * Usage:
 *   router.get('/students', requireRole(ROLES.STAFF, ROLES.ADMIN), controller.getStudents);
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(403, 'You do not have permission to perform this action.')
      );
    }

    next();
  };
}
