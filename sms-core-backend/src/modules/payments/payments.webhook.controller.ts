import { NextFunction, Request, Response } from 'express';
import { PaymentsWebhookService } from './payments.webhook.service';

export class PaymentsWebhookController {
  constructor(private readonly webhookService: PaymentsWebhookService) {}

  handlePaystackWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!Buffer.isBuffer(req.body)) {
        return res.status(400).json({ success: false, message: 'Expected raw webhook body.' });
      }

      await this.webhookService.recordPaystackEvent(
        req.body,
        req.headers['x-paystack-signature'],
      );

      // Paystack requires a 200 acknowledgement for successfully handled,
      // duplicate, and intentionally ignored events.
      return res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  };
}
