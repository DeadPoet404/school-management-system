import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { SetupController } from './setup.controller';

const router = Router();
const controller = new SetupController();

// Public status is cheap but still rate-limited so scanners cannot hammer DB counts.
const statusLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.SETUP_STATUS_RATE_LIMIT_MAX || '60', 10),
  message: {
    success: false,
    message: 'Too many setup status requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * GET /api/setup/status — first-start readiness probe (public)
 */
router.get('/status', statusLimiter, controller.getStatus.bind(controller));

export default router;
