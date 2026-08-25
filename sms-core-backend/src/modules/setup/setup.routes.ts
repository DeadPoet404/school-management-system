import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { SetupController } from './setup.controller';

const router = Router();
const controller = new SetupController();

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

const bootstrapLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.SETUP_BOOTSTRAP_RATE_LIMIT_MAX || '5', 10),
  message: {
    success: false,
    message: 'Too many bootstrap attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/status', statusLimiter, controller.getStatus.bind(controller));
router.post('/bootstrap', bootstrapLimiter, controller.bootstrap.bind(controller));

export default router;
