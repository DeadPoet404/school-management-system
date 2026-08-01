import { Router, raw } from 'express';
import { PaymentsWebhookController } from './payments.webhook.controller';
import { PaymentsWebhookService } from './payments.webhook.service';

const router = Router();
const service = new PaymentsWebhookService();
const controller = new PaymentsWebhookController(service);

// This route is public by design: Paystack cannot hold an SMS JWT cookie.
// It must be mounted before auditLog and express.json so the HMAC is computed
// from the exact raw bytes Paystack signed.
router.post(
  '/paystack',
  raw({ type: 'application/json', limit: '1mb' }),
  controller.handlePaystackWebhook,
);

export default router;
