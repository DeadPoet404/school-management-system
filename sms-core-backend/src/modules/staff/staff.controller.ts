import { Request, Response, NextFunction } from "express";
import { StaffService } from "./staff.service";
import { parsePaginationQuery, buildPaginationResponse } from "@/utils/pagination";
import { toCSV, respondCSV } from "@/utils/export";

export class StaffController {
  constructor(private staffService: StaffService) {}

  public getAllStaff = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { page, limit, skip } = parsePaginationQuery(req.query);
      const filters = {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        departmentId: typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined,
        jobTitle: typeof req.query.jobTitle === 'string' ? req.query.jobTitle : undefined,
        employmentType: typeof req.query.employmentType === 'string' ? req.query.employmentType : undefined,
        gender: typeof req.query.gender === 'string' ? req.query.gender : undefined,
      };
      const { data, total } = await this.staffService.getFilteredPaginated(filters, skip, limit);

      if (req.query.format === "csv") {
        const allData = await this.staffService.getAllFiltered(filters);
        return respondCSV(res, toCSV(allData), "staff");
      }

      return res.status(200).json(buildPaginationResponse(data, total, page, limit));
    } catch (error) {
      next(error);
    }
  };

  public getStaffById = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { id } = req.params;
      const staff = await this.staffService.getById(id!);
      return res.status(200).json({ success: true, data: staff });
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

  public updateStaff = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { id } = req.params;
      const updated = await this.staffService.update(id!, req.body);
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

}
