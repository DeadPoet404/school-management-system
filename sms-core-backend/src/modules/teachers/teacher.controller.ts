import { Request, Response, NextFunction } from "express";
import { TeacherService } from "./teacher.service";
import { parsePaginationQuery, buildPaginationResponse } from "@/utils/pagination";
import { toCSV, respondCSV } from "@/utils/export";

export class TeacherController {
  constructor(private teacherService: TeacherService) {}
  
  public getAllTeachers = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { page, limit, skip } = parsePaginationQuery(req.query);
      const filters = {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        department: typeof req.query.department === 'string' ? req.query.department : undefined,
        subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
        employmentType: typeof req.query.employmentType === 'string' ? req.query.employmentType : undefined,
        gender: typeof req.query.gender === 'string' ? req.query.gender : undefined,
      };
      const { data, total } = await this.teacherService.getFilteredPaginated(filters, skip, limit);

      if (req.query.format === "csv") {
        const allData = await this.teacherService.getAllFiltered(filters);
        return respondCSV(res, toCSV(allData), "teachers");
      }

      return res.status(200).json(buildPaginationResponse(data, total, page, limit));
    } catch (error) {
      next(error);
    }
  };

  public getTeacherById = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { id } = req.params;
      const teacher = await this.teacherService.getById(id);
      return res.status(200).json({ success: true, data: teacher });
    } catch (error) {
      next(error);
    }
  };

  public createTeacher = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { account, placement, demographics } = req.body;

      if (!account?.fullName || !account?.email) {
        return res.status(400).json({ success: false, message: "Missing core identity payloads (fullName and email are required)." });
      }

      // Defense-in-depth: reject missing demographics even if validation
      // schema hasn't been updated yet (Phase 3, Task 3.1). The service
      // also guards against this, but catching it here returns a 400
      // instead of a 500 from an unhandled service error.
      if (!demographics?.gender || !demographics?.dateOfBirth || !demographics?.phone || !demographics?.residentialAddress) {
        return res.status(400).json({
          success: false,
          message: "Missing required demographic fields (gender, dateOfBirth, phone, residentialAddress). Fabricated PII is not permitted.",
        });
      }

      const newTeacher = await this.teacherService.createTeacher({
        account: { fullName: account.fullName, email: account.email, password: account.password },
        placement: placement ? { departmentId: placement.departmentId, jobTitle: placement.jobTitle, employmentType: placement.employmentType } : undefined,
        demographics,
      });

      // TODO: Phase 4 Task 4.1 — Replace password-in-response with
      // email-based delivery. The underscore prefix signals internal
      // fields that should be stripped by API versioning middleware.
      const response: Record<string, unknown> = {
        success: true,
        teacherId: newTeacher.teacherId,
        name: newTeacher.teacherName,
        message: "Faculty profile saved to database successfully.",
      };


      return res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public executeDeparture = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { teacherId, departureType, effectiveDate, clearance, remarks } = req.body;

      if (!teacherId || !departureType || !effectiveDate || !clearance?.academic || !clearance?.treasury || !remarks) {
        return res.status(400).json({ success: false, message: "Missing structural faculty departure payload dependencies." });
      }

      const result = await this.teacherService.processDeparture({
        teacherId, departureType, effectiveDate,
        clearance: { academic: clearance.academic, treasury: clearance.treasury },
        remarks,
      });

      return res.status(200).json({ success: true, message: `Faculty departure pipeline finalized for ID: ${teacherId}`, data: result });
    } catch (error) {
      next(error);
    }
  };

  public updateTeacher = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { id } = req.params;
      const updated = await this.teacherService.update(id, req.body);
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

}
