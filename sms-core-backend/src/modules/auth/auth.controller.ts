import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '@/middleware/error.handler';
import { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { AuthService } from './auth.service';
import { blockToken } from '@/lib/token-blocklist';

const loginSchema = z.object({
  email: z.string().email('A valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Builds cookie options from environment variables.
 *
 * COOKIE_SECURE and COOKIE_SAME_SITE are validated and normalised by
 * env.ts before this function is ever called, so process.env values
 * here are guaranteed to be well-formed strings.
 *
 * Why not use NODE_ENV directly?
 * NODE_ENV=production is required for Next.js, Express optimisations,
 * and many libraries — but it does NOT mean the transport is HTTPS.
 * In Docker on localhost the transport is plain HTTP even in
 * "production" mode, so we need an explicit COOKIE_SECURE flag that
 * the operator controls independently of NODE_ENV.
 */
function getCookieOptions() {
  // env.ts has already written "true" or "false" back to process.env
  const secure = process.env.COOKIE_SECURE === 'true';

  // env.ts has already validated this is one of lax | strict | none
  const sameSite = (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ?? 'lax';

  // COOKIE_DOMAIN must be empty / undefined for localhost.
  // Setting Domain=localhost violates RFC 6265 and browsers reject it.
  const domain = process.env.COOKIE_DOMAIN || undefined;

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    domain,
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
        throw new AppError(400, parsed.error.issues[0]!.message);
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
   * Uses getCookieOptions() so secure/sameSite flags match exactly
   * what was used to set the cookies — mismatched flags cause
   * browsers to ignore the clear instruction.
   */
  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const refreshTokenValue = req.cookies?.refresh_token;
      await this.authService.logout(refreshTokenValue || '');

      // Block the access token immediately so it cannot be reused
      const accessToken = req.cookies?.access_token;
      if (accessToken) blockToken(accessToken);

      // Use the same options that were used to SET the cookies.
      // If the flags differ (e.g. Secure mismatch) browsers treat
      // them as different cookies and the clear has no effect.
      const clearOpts = {
        ...getCookieOptions(),
        maxAge: 0,
      };

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
