import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { comparePassword } from '@/utils/hash';
import { AppError } from '@/middleware/error.handler';
import { JwtPayload } from '@/types/auth.types';

export class AuthService {
  /**
   * Attempts login against StudentAccount, then StaffAccount, then TeacherAccount.
   * Returns a signed JWT and public user metadata.
   */
  async login(email: string, password: string) {
    // ── 1. Try StudentAccount (field: portalEmail) ──
    const studentAccount = await prisma.studentAccount.findUnique({
      where: { portalEmail: email },
      include: { student: { select: { id: true, status: true } } },
    });

    if (studentAccount) {
      const isValid = await comparePassword(password, studentAccount.passwordHash);
      if (!isValid) throw new AppError(401, 'Invalid email or password');
      if (studentAccount.student?.status === 'DEPARTED') {
        throw new AppError(403, 'Account is inactive. Contact administration.');
      }

      return this.signToken({
        sub: studentAccount.id,
        email: studentAccount.portalEmail,
        role: 'STUDENT',
        entityType: 'STUDENT',
        entityInternalId: studentAccount.student!.id,
      });
    }

    // ── 2. Try StaffAccount (field: email) — covers STAFF and legacy FACULTY ──
    const staffAccount = await prisma.staffAccount.findUnique({
      where: { email },
      include: { staff: { select: { id: true, status: true } } },
    });

    if (staffAccount) {
      const isValid = await comparePassword(password, staffAccount.passwordHash);
      if (!isValid) throw new AppError(401, 'Invalid email or password');
      if (staffAccount.staff?.status === 'DEPARTED') {
        throw new AppError(403, 'Account is inactive. Contact administration.');
      }

      return this.signToken({
        sub: staffAccount.id,
        email: staffAccount.email,
        role: staffAccount.role,
        entityType: 'STAFF',
        entityInternalId: staffAccount.staff!.id,
      });
    }

    // ── 3. Try TeacherAccount (field: email) — for teachers created after TeacherAccount model ──
    const teacherAccount = await prisma.teacherAccount.findUnique({
      where: { email },
      include: { teacher: { select: { id: true, status: true } } },
    });

    if (teacherAccount) {
      const isValid = await comparePassword(password, teacherAccount.passwordHash);
      if (!isValid) throw new AppError(401, 'Invalid email or password');
      if (teacherAccount.teacher?.status === 'DEPARTED') {
        throw new AppError(403, 'Account is inactive. Contact administration.');
      }

      return this.signToken({
        sub: teacherAccount.id,
        email: teacherAccount.email,
        role: teacherAccount.role,
        entityType: 'TEACHER',
        entityInternalId: teacherAccount.teacher!.id,
      });
    }

    // ── 4. No account matched ──
    throw new AppError(401, 'Invalid email or password');
  }

  /**
   * Signs a JWT with the provided payload.
   * Reads secret and expiry from environment variables.
   */
  private signToken(payload: JwtPayload) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError(500, 'Authentication service is not configured.');
    }

    const options = { expiresIn: process.env.JWT_EXPIRES_IN || '8h' } as SignOptions;

    const token = jwt.sign(payload, secret, options);

    return {
      token,
      user: {
        email: payload.email,
        role: payload.role,
        entityType: payload.entityType,
        entityInternalId: payload.entityInternalId,
      },
    };
  }
}
