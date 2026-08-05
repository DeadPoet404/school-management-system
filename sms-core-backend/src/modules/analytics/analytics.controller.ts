import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service';

function parseQueryInt(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

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

  // ── SMS-011: granular per-widget endpoints ──

  getCollectionsByChannel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getCollectionsByChannel(parseQueryInt(req.query.months));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getExpenseBreakdown = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getExpenseBreakdown(parseQueryInt(req.query.months));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getReceivablesAging = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getReceivablesAging();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getAttendanceByClass = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getAttendanceByClass({
        date: typeof req.query.date === 'string' ? req.query.date : undefined,
        range: typeof req.query.range === 'string' ? req.query.range : undefined,
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getEnrollmentDistribution = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getEnrollmentDistribution();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getAcademicPerformance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getAcademicPerformance(
        typeof req.query.termId === 'string' ? req.query.termId : undefined,
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getPayrollSummary = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getPayrollSummary();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getTopDebtors = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getTopDebtors(parseQueryInt(req.query.limit));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getActivityFeed = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getActivityFeed(parseQueryInt(req.query.limit));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
