import { Request, Response, NextFunction } from 'express';
import { SetupService } from './setup.service';

export class SetupController {
  constructor(private service: SetupService = new SetupService()) {}

  /**
   * GET /api/setup/status
   * Public first-start probe used by the frontend gate and wizard shell.
   */
  async getStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await this.service.getStatus();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
