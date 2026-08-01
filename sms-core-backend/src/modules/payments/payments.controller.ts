import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { PaymentsService } from './payments.service';

export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  createPaystackIntent = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.paymentsService.createPaystackIntent(
        req.body,
        req.user?.email ?? 'unknown',
      );

      return res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
