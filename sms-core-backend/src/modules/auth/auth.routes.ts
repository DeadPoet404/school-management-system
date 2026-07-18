import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { authenticate } from '@/middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

// Stricter rate limit for login only
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

// P1-2/P1-3: Rate limit for public token endpoints (refresh/logout).
// Prevents DoS via repeated JWT verification + DB lookups on refresh,
// and abuse of the deleteMany query on logout.
// More permissive than login (15/min) because the frontend auto-calls
// refresh every 15 minutes and a user may logout from multiple devices.
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

// Public — rate-limited
router.post('/login', authLimiter, authController.login.bind(authController));

// Public — rate-limited (uses refresh token cookie, not access token)
router.post('/refresh', tokenEndpointLimiter, authController.refresh.bind(authController));

// Public — rate-limited (revokes refresh token, clears cookies)
router.post('/logout', tokenEndpointLimiter, authController.logout.bind(authController));

// Protected — requires valid access token
router.get('/me', authenticate, authController.me.bind(authController));

export default router;
