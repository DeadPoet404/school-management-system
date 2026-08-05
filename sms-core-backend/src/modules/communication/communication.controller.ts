import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { CommunicationService } from './communication.service';
import { notificationDispatchWorker } from './communication.worker';

export class CommunicationController {
  private communicationService = new CommunicationService();

  /** POST /announcements -- ADMIN composes and sends (queues + immediate kick). */
  compose = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.communicationService.compose(req.body, {
        id: user.sub,
        email: user.email,
      });
      // Fire the worker now instead of waiting a full sweep interval.
      notificationDispatchWorker.kick();
      return res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  /** GET /announcements -- ADMIN + STAFF (read-only). */
  list = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.communicationService.listAnnouncements();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  /** GET /announcements/:id/deliveries -- ADMIN + STAFF (read-only). */
  deliveries = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.communicationService.getDeliveries(String(req.params.id));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
