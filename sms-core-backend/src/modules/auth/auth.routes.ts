import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { authenticate } from '@/middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

// ── PER-ACCOUNT RATE LIMITING ──
// Tracks failed login attempts per email address.
// After MAX_FAILED_ATTEMPTS, the account is locked for LOCKOUT_DURATION_MS.
// This is in-memory only — resets on server restart, which is acceptable
// for a single-instance school management system. For multi-instance
// deployments, this should be replaced with Redis-backed storage.
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes — reset counter after this

function isAccountLocked(email: string): { locked: boolean; retryAfterMs: number } {
  const record = failedAttempts.get(email.toLowerCase());
  if (!record) return { locked: false, retryAfterMs: 0 };

  // Clean up expired lockout
  if (record.lockedUntil > 0 && Date.now() > record.lockedUntil) {
    failedAttempts.delete(email.toLowerCase());
    return { locked: false, retryAfterMs: 0 };
  }

  if (record.lockedUntil > 0) {
    return { locked: true, retryAfterMs: record.lockedUntil - Date.now() };
  }

  // Reset counter if window has elapsed
  if (Date.now() - record.lockedUntil > ATTEMPT_WINDOW_MS && record.count > 0) {
    failedAttempts.delete(email.toLowerCase());
  }

  return { locked: false, retryAfterMs: 0 };
}

function recordFailedAttempt(email: string): void {
  const key = email.toLowerCase();
  const record = failedAttempts.get(key);

  if (!record) {
    failedAttempts.set(key, { count: 1, lockedUntil: 0 });
    return;
  }

  record.count++;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
}

function resetFailedAttempts(email: string): void {
  failedAttempts.delete(email.toLowerCase());
}

// Export for testing
export const _internal = { isAccountLocked, recordFailedAttempt, resetFailedAttempts, failedAttempts };

// ── IP-BASED RATE LIMITER (first layer of defense) ──
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '5', 10),
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── TOKEN ENDPOINT RATE LIMITER ──
const tokenEndpointLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: 15,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── LOGIN WITH PER-ACCOUNT LOCKOUT ──
router.post('/login', authLimiter, async (req, res, next) => {
  const { email } = req.body || {};

  // Check per-account lockout BEFORE calling the controller
  if (email) {
    const { locked, retryAfterMs } = isAccountLocked(email);
    if (locked) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked due to too many failed attempts. Try again in ${retryAfterSec} seconds.`,
      });
    }
  }

  // Store original res.json to intercept the response
  const originalJson = res.json.bind(res);
  res.json = function (data: unknown) {
    // Restore original
    res.json = originalJson;

    // Check if login failed (401 = bad credentials)
    const resp = data as Record<string, unknown>;
    if (res.statusCode === 401 && email) {
      recordFailedAttempt(email);
    }

    // Check if login succeeded — reset counter
    if (res.statusCode === 200 && email) {
      resetFailedAttempts(email);
    }

    return originalJson(data);
  };

  return authController.login.bind(authController)(req, res, next);
});

// Public — rate-limited (uses refresh token cookie, not access token)
router.post('/refresh', tokenEndpointLimiter, authController.refresh.bind(authController));

// Public — rate-limited (revokes refresh token, clears cookies)
router.post('/logout', tokenEndpointLimiter, authController.logout.bind(authController));

// Protected — requires valid access token
router.get('/me', authenticate, authController.me.bind(authController));

export default router;
