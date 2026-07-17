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

// Public — rate-limited
router.post('/login', authLimiter, authController.login.bind(authController));

// Public — uses refresh token cookie, not access token
router.post('/refresh', authController.refresh.bind(authController));

// Public — revokes refresh token, clears cookies
router.post('/logout', authController.logout.bind(authController));

// Protected — requires valid access token
router.get('/me', authenticate, authController.me.bind(authController));

export default router;
