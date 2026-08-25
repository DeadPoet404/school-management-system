import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/middleware/error.handler';
import { SetupService } from './setup.service';
import { bootstrapSetupSchema } from './setup.validation';

export class SetupController {
  constructor(private service: SetupService = new SetupService()) {}

  async getStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await this.service.getStatus();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/setup/bootstrap
   * Public only while no ADMIN exists and setup is incomplete.
   */
  async bootstrap(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = bootstrapSetupSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message ?? 'Invalid bootstrap payload.');
      }

      const data = await this.service.bootstrap(parsed.data);
      res.status(201).json({
        success: true,
        message:
          'School profile and founding administrator created. Sign in as the admin to continue the setup wizard.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
