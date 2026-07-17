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
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
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
   * Look up an account by email across StudentAccount, StaffAccount, TeacherAccount.
   * Returns a normalized shape or null.
   *
   * NOTE: Still uses 3 sequential DB lookups (finding B-14 timing oracle).
   * Fix requires a unified login DB view — deferred to P2.
   */
  private async findAccountByEmail(email: string) {
    const studentAccount = await prisma.studentAccount.findUnique({
      where: { portalEmail: email },
      include: { student: { select: { id: true, status: true } } },
    });
    if (studentAccount) {
      return {
        accountId: studentAccount.id,
        email: studentAccount.portalEmail,
        passwordHash: studentAccount.passwordHash,
        role: 'STUDENT',
        entityType: 'STUDENT' as const,
        userId: studentAccount.student!.id,
        status: studentAccount.student?.status,
      };
    }

    const staffAccount = await prisma.staffAccount.findUnique({
      where: { email },
      include: { staff: { select: { id: true, status: true } } },
    });
    if (staffAccount) {
      return {
        accountId: staffAccount.id,
        email: staffAccount.email,
        passwordHash: staffAccount.passwordHash,
        role: staffAccount.role,
        entityType: 'STAFF' as const,
        userId: staffAccount.staff!.id,
        status: staffAccount.staff?.status,
      };
    }

    const teacherAccount = await prisma.teacherAccount.findUnique({
      where: { email },
      include: { teacher: { select: { id: true, status: true } } },
    });
    if (teacherAccount) {
      return {
        accountId: teacherAccount.id,
        email: teacherAccount.email,
        passwordHash: teacherAccount.passwordHash,
        role: teacherAccount.role,
        entityType: 'TEACHER' as const,
        userId: teacherAccount.teacher!.id,
        status: teacherAccount.teacher?.status,
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
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
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
