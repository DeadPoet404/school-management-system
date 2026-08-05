import { AppError } from './error.handler';
import { ROLES } from './rbac.middleware';
import { JwtPayload } from '@/types/auth.types';

/**
 * Object-level authorization for student-scoped reads.
 *
 * Privileged roles (anything other than STUDENT) may access any studentId.
 * STUDENT callers may only access their own entityInternalId (Student.id).
 *
 * Used by GET /attendance/student/:studentId and GET /grades/student/:studentId
 * to close IDOR gaps (PR1 / issue 9).
 */
export function assertSelfOrPrivilegedStudentAccess(
  user: JwtPayload | undefined,
  requestedStudentId: string,
): void {
  if (!user) {
    throw new AppError(401, 'Authentication required.');
  }

  if (user.role !== ROLES.STUDENT) {
    return;
  }

  if (!requestedStudentId || requestedStudentId !== user.entityInternalId) {
    throw new AppError(403, 'You can only access your own records.');
  }
}

// SMS-005: Session-resolved student identity for the /me endpoint family.
// The student id ALWAYS comes from the verified JWT -- never from request
// params, query, or body -- making cross-student access impossible by
// construction rather than by convention.
export function resolveSessionStudentId(user: JwtPayload | undefined): string {
  if (!user) {
    throw new AppError(401, 'Authentication required.');
  }
  if (user.entityType !== 'STUDENT' || !user.entityInternalId) {
    throw new AppError(403, 'This endpoint is for student self-service.');
  }
  return user.entityInternalId;
}
