import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '@/middleware/auth.middleware';
import { requireRole, ROLES } from '@/middleware/rbac.middleware';
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

const adminOnly = [authenticate, requireRole(ROLES.ADMIN)] as const;

router.get('/status', statusLimiter, controller.getStatus.bind(controller));
router.post('/bootstrap', bootstrapLimiter, controller.bootstrap.bind(controller));

router.post('/academic', ...adminOnly, controller.saveAcademic.bind(controller));
router.post('/classes', ...adminOnly, controller.saveClasses.bind(controller));
router.post('/curriculum', ...adminOnly, controller.saveCurriculum.bind(controller));
router.post('/ledger', ...adminOnly, controller.saveLedger.bind(controller));
router.post('/complete', ...adminOnly, controller.complete.bind(controller));

export default router;
