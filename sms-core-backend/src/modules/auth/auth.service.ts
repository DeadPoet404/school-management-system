import jwt, { SignOptions, JwtPayload as JsonWebTokenPayload } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { comparePassword } from '@/utils/hash';
import { AppError } from '@/middleware/error.handler';
import { JwtPayload } from '@/types/auth.types';

export class AuthService {
  /**
   * Login: validate credentials across all 3 account tables.
   * Returns access token (stateless, 15min) + refresh token (stateful, 7d, DB-backed).
   */
  async login(email: string, password: string) {
    const account = await this.findAccountByEmail(email);
    if (!account) {
      throw new AppError(401, 'Invalid email or password');
    }

    const isValid = await comparePassword(password, account.passwordHash);
    if (!isValid) {
      throw new AppError(401, 'Invalid email or password');
    }

    if (account.status === 'DEPARTED') {
      throw new AppError(403, 'Account is inactive. Contact administration.');
    }

    const payload: JwtPayload = {
      sub: account.accountId,
      email: account.email,
      role: account.role,
      entityType: account.entityType,
      entityInternalId: account.userId,
    };

    return this.signTokenPair(payload);
  }

  /**
   * Refresh: validate refresh token from cookie, rotate it (single-use),
   * issue new access + refresh token pair.
   */
  async refresh(refreshTokenValue: string) {
    // P1-9: No fallback to JWT_SECRET — refresh tokens MUST use
    // a separate signing key. If JWT_REFRESH_SECRET is not set,
    // env.ts validation will prevent the server from starting.
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new AppError(500, 'Authentication service is not configured.');

    let decoded: JsonWebTokenPayload;
    try {
      decoded = jwt.verify(refreshTokenValue, secret, { algorithms: ['HS256'] }) as JsonWebTokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError(401, 'Refresh token has expired. Please log in again.');
      }
      throw new AppError(401, 'Invalid refresh token. Please log in again.');
    }

    // Must exist in DB and not be revoked
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenValue },
    });

    if (!stored || stored.revokedAt) {
      throw new AppError(401, 'Invalid refresh token. Please log in again.');
    }

    // Delete old token (rotation — single use)
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    // Issue new pair
    const payload: JwtPayload = {
      sub: decoded.sub as string,
      email: decoded.email as string,
      role: decoded.role as string,
      entityType: decoded.entityType as 'STUDENT' | 'STAFF' | 'TEACHER',
      entityInternalId: decoded.entityInternalId as string,
    };

    return this.signTokenPair(payload);
  }

  /**
   * Logout: revoke the refresh token so it cannot be used again.
   * Access token remains valid until its short expiry (up to 15 min).
   */
  async logout(refreshTokenValue: string) {
    if (!refreshTokenValue) return;
    await prisma.refreshToken.deleteMany({
      where: { token: refreshTokenValue },
    });
  }

  /**
   * Return user metadata from an already-verified JWT payload.
   * Used by GET /auth/me for frontend session validation.
   */
  async me(payload: JwtPayload) {
    return {
      email: payload.email,
      role: payload.role,
      entityType: payload.entityType,
      entityInternalId: payload.entityInternalId,
    };
  }

  // ── PRIVATE HELPERS ──

  /**
   * P1-1 fix: Look up an account by email across all 3 account tables
   * using parallel queries instead of sequential lookups.
   *
   * HOW THIS FIXES THE TIMING ORACLE:
   * The old implementation queried StudentAccount, then StaffAccount, then
   * TeacherAccount sequentially. If the email belonged to a student, the
   * response came back after 1 query (~20ms). If it belonged to a teacher,
   * it took 3 queries (~60-80ms). An attacker could determine account type
   * by measuring response time.
   *
   * Promise.all fires all 3 queries simultaneously and waits for ALL to
   * complete before returning. Total time is always ~max(query1, query2,
   * query3) regardless of which table contains the match, eliminating the
   * timing side-channel.
   */
  private async findAccountByEmail(email: string) {
    const [studentAccount, staffAccount, teacherAccount] = await Promise.all([
      prisma.studentAccount.findUnique({
        where: { portalEmail: email },
        include: { student: { select: { id: true, status: true } } },
      }),
      prisma.staffAccount.findUnique({
        where: { email },
        include: { staff: { select: { id: true, status: true } } },
      }),
      prisma.teacherAccount.findUnique({
        where: { email },
        include: { teacher: { select: { id: true, status: true } } },
      }),
    ]);

    // Use optional chaining instead of ! to handle edge case where
    // account exists but related record was hard-deleted
    if (studentAccount?.student) {
      return {
        accountId: studentAccount.id,
        email: studentAccount.portalEmail,
        passwordHash: studentAccount.passwordHash,
        role: 'STUDENT',
        entityType: 'STUDENT' as const,
        userId: studentAccount.student.id,
        status: studentAccount.student.status,
      };
    }

    if (staffAccount?.staff) {
      return {
        accountId: staffAccount.id,
        email: staffAccount.email,
        passwordHash: staffAccount.passwordHash,
        role: staffAccount.role,
        entityType: 'STAFF' as const,
        userId: staffAccount.staff.id,
        status: staffAccount.staff.status,
      };
    }

    if (teacherAccount?.teacher) {
      return {
        accountId: teacherAccount.id,
        email: teacherAccount.email,
        passwordHash: teacherAccount.passwordHash,
        role: teacherAccount.role,
        entityType: 'TEACHER' as const,
        userId: teacherAccount.teacher.id,
        status: teacherAccount.teacher.status,
      };
    }

    return null;
  }

  /**
   * Sign both access and refresh tokens.
   * Access: stateless, short-lived, verified by signature alone.
   * Refresh: stateful, long-lived, stored in DB for revocation/rotation.
   */
  private async signTokenPair(payload: JwtPayload) {
    const accessToken = this.signAccessToken(payload);
    const refreshToken = await this.signRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      user: {
        email: payload.email,
        role: payload.role,
        entityType: payload.entityType,
        entityInternalId: payload.entityInternalId,
      },
    };
  }

  private signAccessToken(payload: JwtPayload): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new AppError(500, 'Authentication service is not configured.');

    const options: SignOptions = {
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as SignOptions['expiresIn'],
      algorithm: 'HS256',
    };

    return jwt.sign(payload, secret, options);
  }

  private async signRefreshToken(payload: JwtPayload): Promise<string> {
    // P1-9: No fallback to JWT_SECRET — refresh tokens MUST use
    // a separate signing key to prevent cross-type token forgery.
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new AppError(500, 'Authentication service is not configured.');

    const options: SignOptions = {
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
      algorithm: 'HS256',
    };

    const token = jwt.sign(payload, secret, options);
    const decoded = jwt.decode(token) as JsonWebTokenPayload;
    const expiresAt = new Date((decoded.exp as number) * 1000);

    await prisma.refreshToken.create({
      data: {
        token,
        accountId: payload.sub,
        accountType: payload.entityType,
        userId: payload.entityInternalId,
        expiresAt,
      },
    });

    return token;
  }
}
