import { Router } from 'express';
import { requireRole, ROLES } from '@/middleware/rbac.middleware';
import { validate } from '@/middleware/validate';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { createPaymentIntentSchema } from './payments.validation';

const router = Router();
const service = new PaymentsService();
const controller = new PaymentsController(service);

// In V1 this is a staff-operated collection flow. Student and parent portal
// access will be added only with object-level parent/student authorization.
router.post(
  '/intents',
  requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate(createPaymentIntentSchema),
  controller.createPaystackIntent,
);

export default router;
