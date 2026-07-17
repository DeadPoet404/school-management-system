import { Request, Response, NextFunction } from "express";
import { StaffService } from "./staff.service";
import { parsePaginationQuery, buildPaginationResponse } from "@/utils/pagination";

export class StaffController {
  constructor(private staffService: StaffService) {}

  public getAllStaff = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { page, limit, skip } = parsePaginationQuery(req.query);
      const { data, total } = await this.staffService.getPaginatedStaff(skip, limit);
      return res.status(200).json(buildPaginationResponse(data, total, page, limit));
    } catch (error) {
      next(error);
    }
  };

  public getWorkforceMatrix = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const matrix = await this.staffService.getWorkforceMatrix();
      return res.status(200).json({ success: true, data: matrix });
    } catch (error) {
      next(error);
    }
  };

  public createStaff = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { account, demographics, placement, compliance, payroll } = req.body;

      if (!account?.fullName || !account?.email || !account?.password) {
        return res.status(400).json({ success: false, message: "Missing core onboarding requirements (fullName, email, and password are required)." });
      }

      const newStaff = await this.staffService.createStaff({
        account: { fullName: account.fullName, email: account.email, password: account.password, employmentDate: account.employmentDate || new Date().toISOString(), role: account.role },
        demographics, placement, compliance, payroll,
      });

      return res.status(201).json({ success: true, message: "Atomic staff registration ingestion transaction pipelines complete.", data: newStaff });
    } catch (error) {
      next(error);
    }
  };

  public executeDeparture = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { staffId, departureType, effectiveDate, clearance, remarks } = req.body;

      if (!staffId || !departureType || !effectiveDate || !clearance?.hr || !clearance?.itAssets || !clearance?.treasury || !remarks) {
        return res.status(400).json({ success: false, message: "Missing structural staff departure payload dependencies." });
      }

      const result = await this.staffService.processDeparture({
        staffId, departureType, effectiveDate,
        clearance: { hr: clearance.hr, itAssets: clearance.itAssets, treasury: clearance.treasury },
        remarks,
      });

      return res.status(200).json({ success: true, message: `Staff departure pipeline finalized for ID: ${staffId}`, data: result });
    } catch (error) {
      next(error);
    }
  };
}
