import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { TeacherService } from "./teacher.service";
import { parsePaginationQuery, buildPaginationResponse } from "@/utils/pagination";
import { toCSV, respondCSV } from "@/utils/export";
import {
  toTeacherDtoForRole,
  toTeacherListDtoForRole,
} from "@/lib/role-dtos";
import type { DeliveryOutcome as CredentialDeliveryOutcome } from "@/lib/credential-email";

type UploadedTeacherImportFile = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
  size?: number;
};

export class TeacherController {
  constructor(private teacherService: TeacherService) {}

  public getAllTeachers = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const role = req.user?.role;
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
      const safeData = toTeacherListDtoForRole(data, role);

      if (req.query.format === "csv") {
        const allData = await this.teacherService.getAllFiltered(filters);
        const safeAll = toTeacherListDtoForRole(allData, role) as Record<string, unknown>[];
        return respondCSV(res, toCSV(safeAll), "teachers");
      }

      return res.status(200).json(buildPaginationResponse(safeData, total, page, limit));
    } catch (error) {
      next(error);
    }
  };

  public getTeacherById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { id } = req.params;
      const teacher = await this.teacherService.getById(id!);
      const safe = toTeacherDtoForRole(teacher, req.user?.role);
      return res.status(200).json({ success: true, data: safe });
    } catch (error) {
      next(error);
    }
  };

  public importTeachers = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const file = (req as AuthenticatedRequest & { file?: UploadedTeacherImportFile }).file;

      if (!file) {
        return res.status(400).json({ success: false, message: "A CSV, XLSX, or XLS file is required." });
      }

      const summary = await this.teacherService.importTeachersFromFile(file);

      return res.status(200).json({
        success: true,
        message: `Teacher import complete. Created ${summary.created} of ${summary.totalRows} row(s).`,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  };

  public createTeacher = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { account, placement, demographics, compliance, payroll } = req.body;

      if (!account?.fullName || !account?.email) {
        return res.status(400).json({ success: false, message: "Missing core identity payloads (fullName and email are required)."});
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
        account: { fullName: account.fullName, email: account.email, password: account.password, employmentDate: account.employmentDate },
        placement: placement ? { departmentId: placement.departmentId, jobTitle: placement.jobTitle, employmentType: placement.employmentType } : undefined,
        demographics,
        compliance,
        payroll,
      });

      // SMS-013: the temporary password is emailed straight to the teacher.
      // The response carries only a non-sensitive delivery status so the
      // admin knows whether a manual handover is still required.
      const response: Record<string, unknown> = {
        success: true,
        teacherId: newTeacher.teacherId,
        name: newTeacher.teacherName,
        message: "Faculty profile saved to database successfully.",
      };

      const delivery = (newTeacher as { _credentialDelivery?: CredentialDeliveryOutcome })
        ._credentialDelivery;

      if (delivery) {
        response.credentialDelivery = delivery.status;
        response.credentialMessage = delivery.message;
        if (delivery.status !== "SENT") {
          response.warning = delivery.message;
        }
      }

      return res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public executeDeparture = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
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

  public updateTeacher = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { id } = req.params;
      const updated = await this.teacherService.update(id!, req.body);
      const safe = toTeacherDtoForRole(updated, req.user?.role);
      return res.status(200).json({ success: true, data: safe });
    } catch (error) {
      next(error);
    }
  };

}
