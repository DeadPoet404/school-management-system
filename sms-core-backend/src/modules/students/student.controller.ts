import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { StudentService } from "./student.service";
import { parsePaginationQuery, buildPaginationResponse } from "@/utils/pagination";
import { toCSV, respondCSV } from "@/utils/export";
import {
  toStudentDtoForRole,
  toStudentListDtoForRole,
} from "@/lib/role-dtos";
import { resolveSessionStudentId } from "@/middleware/self-access";

type UploadedStudentImportFile = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
  size?: number;
};

export class StudentController {
  constructor(private studentService: StudentService) {}

  public getAllStudents = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const role = req.user?.role;
      const { page, limit, skip } = parsePaginationQuery(req.query);
      const filters = {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
        gender: typeof req.query.gender === 'string' ? req.query.gender : undefined,
        boardingStatus: typeof req.query.boardingStatus === 'string' ? req.query.boardingStatus : undefined,
      };
      const { data, total } = await this.studentService.getFilteredPaginated(filters, skip, limit);
      const safeData = toStudentListDtoForRole(data, role);

      if (req.query.format === "csv") {
        const allData = await this.studentService.getAllFiltered(filters);
        const safeAll = toStudentListDtoForRole(allData, role) as Record<string, unknown>[];
        return respondCSV(res, toCSV(safeAll), "students");
      }

      return res.status(200).json(buildPaginationResponse(safeData, total, page, limit));
    } catch (error) {
      next(error);
    }
  };

  /**
   * SMS-005: GET /api/students/me -- portal self-view profile.
   * Identity is resolved from the verified session (never parameters).
   */
  public getOwnProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const studentId = resolveSessionStudentId(req.user);
      const profile = await this.studentService.getOwnProfile(studentId);
      return res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };

  public getStudentById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { id } = req.params;
      const student = await this.studentService.getById(id!);
      const safe = toStudentDtoForRole(student, req.user?.role);
      return res.status(200).json({ success: true, data: safe });
    } catch (error) {
      next(error);
    }
  };

  public getFinancialMatrix = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const financialLedger = await this.studentService.getFinancialMatrix();
      return res.status(200).json({ success: true, data: financialLedger });
    } catch (error) {
      next(error);
    }
  };

  public enrollStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { account, demographics, placement, compliance, billing, payroll, guardian, parent } = req.body;

      if (!account?.fullName || !account?.email) {
        return res.status(400).json({ success: false, message: "Missing core identity payloads (fullName and email are required)."});
      }

      const newStudent = await this.studentService.createStudent({
        account: { fullName: account.fullName, email: account.email, password: account.password, enrollmentDate: account.enrollmentDate || new Date().toISOString() },
        demographics, placement, compliance,
        // D-03: the controller previously destructured neither `guardian` nor
        // `parent`, so the service never received one and rejected every single
        // enrollment with a 400. Both are forwarded; the service prefers
        // `guardian` and falls back to `parent`.
        guardian,
        parent,
        billing: billing || payroll,
      });

      return res.status(201).json({ success: true, message: "Student enrollment pipeline complete.", data: { id: newStudent.id, studentId: newStudent.studentId, studentName: newStudent.studentName } });
    } catch (error) {
      next(error);
    }
  };

  public importStudents = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const file = (req as AuthenticatedRequest & { file?: UploadedStudentImportFile }).file;

      if (!file) {
        return res.status(400).json({ success: false, message: "A CSV, XLSX, or XLS file is required." });
      }

      const summary = await this.studentService.importStudentsFromFile(file);

      return res.status(200).json({
        success: true,
        message: `Student import complete. Created ${summary.created} of ${summary.totalRows} row(s).`,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  };

  public executeDeparture = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { studentId, departureType, effectiveDate, disposition, remarks } = req.body;

      if (!studentId || !departureType || !effectiveDate) {
        return res.status(400).json({ success: false, message: "Missing core institutional student departure details." });
      }

      const result = await this.studentService.processDeparture({
        studentId, departureType, effectiveDate,
        disposition,
        remarks: remarks || "Standard Student Separation Sequence Finalized",
      });

      return res.status(200).json({ success: true, message: `Departure processing finalized for ID: ${studentId}`, data: result });
    } catch (error) {
      next(error);
    }
  };

  public updateStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { id } = req.params;
      const updated = await this.studentService.update(id!, req.body);
      // Updates are staff/admin-only; still project in case role matrix expands later.
      const safe = toStudentDtoForRole(updated, req.user?.role);
      return res.status(200).json({ success: true, data: safe });
    } catch (error) {
      next(error);
    }
  };

}
