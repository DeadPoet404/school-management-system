import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service';

export class AnalyticsController {
  private analyticsService = new AnalyticsService();

  getDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawDays = typeof req.query.days === 'string' ? Number.parseInt(req.query.days, 10) : undefined;
      const data = await this.analyticsService.getDashboard(rawDays);

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
