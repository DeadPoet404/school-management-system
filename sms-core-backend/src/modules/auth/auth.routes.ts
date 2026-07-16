import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';

const router = Router();
const authController = new AuthController();

// Stricter rate limit for authentication endpoints
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

router.post('/login', authLimiter, authController.login.bind(authController));

export default router;
