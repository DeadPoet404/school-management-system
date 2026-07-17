import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '@/middleware/error.handler';
import { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { AuthService } from './auth.service';

const loginSchema = z.object({
  email: z.string().email('A valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}

export class AuthController {
  private authService = new AuthService();

  /**
   * POST /api/auth/login
   * Validates credentials, sets httpOnly cookies, returns user metadata.
   * NO tokens are returned in the response body.
   */
  async login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0].message);
      }

      const { email, password } = parsed.data;
      const result = await this.authService.login(email, password);
      const cookieOpts = getCookieOptions();

      // Access token — short-lived (15 min)
      res.cookie('access_token', result.accessToken, {
        ...cookieOpts,
        maxAge: 15 * 60 * 1000,
      });

      // Refresh token — long-lived (7 d), rotation-enforced
      res.cookie('refresh_token', result.refreshToken, {
        ...cookieOpts,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({ success: true, data: { user: result.user } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   * Reads refresh_token cookie, validates against DB, rotates it,
   * sets new access + refresh cookies.
   */
  async refresh(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const refreshTokenValue = req.cookies?.refresh_token;
      if (!refreshTokenValue) {
        throw new AppError(401, 'No refresh token provided.');
      }

      const result = await this.authService.refresh(refreshTokenValue);
      const cookieOpts = getCookieOptions();

      res.cookie('access_token', result.accessToken, {
        ...cookieOpts,
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refresh_token', result.refreshToken, {
        ...cookieOpts,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({ success: true, data: { user: result.user } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Revokes the refresh token in DB and clears both cookies.
   */
  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const refreshTokenValue = req.cookies?.refresh_token;
      await this.authService.logout(refreshTokenValue || '');

      const isProduction = process.env.NODE_ENV === 'production';
      const clearOpts = { httpOnly: true, secure: isProduction, sameSite: 'strict' as const, path: '/', maxAge: 0 };

      res.cookie('access_token', '', clearOpts);
      res.cookie('refresh_token', '', clearOpts);

      res.status(200).json({ success: true, message: 'Logged out successfully.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Returns current user from the verified access token.
   * Frontend calls this on mount to validate session.
   */
  async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError(401, 'Not authenticated.');
      }
      const user = await this.authService.me(req.user);
      res.status(200).json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }
}
