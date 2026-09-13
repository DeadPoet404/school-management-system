import { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { AdminService } from "./admin.service";

function parseAuditLimit(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.floor(parsed);
}

export class AdminController {
  constructor(private adminService: AdminService) {}

  public getInstitution = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const institution = await this.adminService.getInstitution();
      res.json({ success: true, message: "Institution profile retrieved.", data: institution });
    } catch (error) {
      next(error);
    }
  };

  public updateInstitution = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const institution = await this.adminService.updateInstitution(req.body);
      res.json({
        success: true,
        message: "Institution profile updated.",
        data: institution,
        meta: institution.schoolCode !== undefined ? { schoolCode: institution.schoolCode } : undefined,
      });
    } catch (error) {
      next(error);
    }
  };

  public getDataSummary = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const summary = await this.adminService.getDataSummary();
      res.json({ success: true, message: "Data summary retrieved.", data: summary });
    } catch (error) {
      next(error);
    }
  };

  public wipeData = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const actor = {
        id: req.user?.sub ?? "unknown",
        email: req.user?.email ?? "unknown",
        role: req.user?.role ?? "unknown",
      };
      const result = await this.adminService.wipeData(req.body, actor);
      res.json({ success: true, message: result.message, data: result });
    } catch (error) {
      next(error);
    }
  };

  public getAuditLog = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const limit = parseAuditLimit(req.query.limit);
      const items = await this.adminService.getAuditLog(limit);
      res.json({
        success: true,
        message: "Audit log retrieved.",
        data: items,
        meta: { limit, returned: items.length },
      });
    } catch (error) {
      next(error);
    }
  };
}
