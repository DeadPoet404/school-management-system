import { Router } from 'express';
import { requireRole, ROLES } from '@/middleware/rbac.middleware';
import { validate } from '@/middleware/validate';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import {
  createSelfPaymentIntentSchema,
} from './payments.validation';

const router = Router();
const service = new PaymentsService();
const controller = new PaymentsController(service);

// SMS-003: the staff-operated POST /intents flow was retired. Paystack checkout
// is initiated exclusively by students via POST /intents/me (portal/website).

// ── Student self-service flow ──
// `authenticate` (mounted globally on /api/payments) runs first; requireRole
// gates to STUDENT; the service resolves the student from the session token.
router.post(
  '/intents/me',
  requireRole(ROLES.STUDENT),
  validate(createSelfPaymentIntentSchema),
  controller.createSelfPaystackIntent,
);

// Student self-service fee summary (balance, invoices, history, pending intent).
router.get(
  '/fees/me',
  requireRole(ROLES.STUDENT),
  controller.getSelfFeesSummary,
);

// Cancel a pending intent. Authorization (owner-student or staff) is enforced
// in the service, so this route needs only `authenticate` (already mounted).
router.post('/intents/:reference/cancel', controller.cancelIntent);

// Status (with optional on-demand verify). Owner-student or staff only.
router.get('/intents/:reference/status', controller.getIntentStatus);

// Staff-only pending-intent view and manual re-check.
router.get(
  '/intents',
  requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT),
  controller.listIntents,
);
router.post(
  '/intents/:reference/reconcile',
  requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT),
  controller.reconcileIntent,
);

export default router;
