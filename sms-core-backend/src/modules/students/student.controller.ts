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
import { AppError } from "@/middleware/error.handler";
import { renderClassListPdf, renderTranscriptPdf } from "@/lib/pdf";
import { renderClassListPrintHtml, normalizeClassListColumns } from "@/lib/class-list-print";

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
        minGpa: typeof req.query.minGpa === 'string' ? req.query.minGpa : undefined,
        minAttendance: typeof req.query.minAttendance === 'string' ? req.query.minAttendance : undefined,
      };
      // Light view is the default for the registry (fast). Heavy view only for CSV export
      // or when explicitly requested via ?view=full
      const view = typeof req.query.view === 'string' ? req.query.view : 'light';
      const useLight = view !== 'full' && req.query.format !== 'csv';

      const { data, total } = useLight
        ? await (this.studentService as any).getFilteredPaginatedLight(filters, skip, limit)
        : await this.studentService.getFilteredPaginated(filters, skip, limit);

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

  /**
   * SMS-008: GET /api/students/:id/transcript.pdf (ADMIN + STAFF only).
   */
  public streamTranscriptPdf = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const data = await this.studentService.getTranscriptForPdf(req.params.id!);
      const pdfBuffer = await renderTranscriptPdf(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="transcript-${data.studentCode}.pdf"`);
      return res.send(pdfBuffer);
    } catch (error) { next(error); }
  };

  /**
   * SMS-008: GET /api/students/me/transcript.pdf (STUDENT, session-resolved).
   */
  public streamOwnTranscriptPdf = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const internalId = resolveSessionStudentId(req.user);
      const data = await this.studentService.getTranscriptForPdf(internalId);
      const pdfBuffer = await renderTranscriptPdf(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="transcript-${data.studentCode}.pdf"`);
      return res.send(pdfBuffer);
    } catch (error) { next(error); }
  };

  /**
   * SMS-009: GET /api/students/class-list.pdf?classId=... (ADMIN + STAFF).
   * Streams a print-ready PDF roster of the class's active students.
   */
  public streamClassListPdf = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const classId = typeof req.query.classId === 'string' ? req.query.classId.trim() : '';
      if (!classId) throw new AppError(400, 'classId query parameter is required.');
      const data = await this.studentService.getClassListForPdf(classId);
      const pdfBuffer = await renderClassListPdf(data);
      res.setHeader('Content-Type', 'application/pdf');
      const fileClass = data.className.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${fileClass}-Class-List-${data.academicYear.replace('/', '-')}.pdf"`,
      );
      return res.send(pdfBuffer);
    } catch (error) { next(error); }
  };

  /**
   * SMS-009b: GET /api/students/class-list.print?classId=... (ADMIN + STAFF).
   * Print-ready HTML that opens the browser's native print dialog on load —
   * the standard Ctrl+P dialog (no PDF download, no new tab).
   */
  public streamClassListPrint = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const classId = typeof req.query.classId === 'string' ? req.query.classId.trim() : '';
      if (!classId) throw new AppError(400, 'classId query parameter is required.');
      // 2026-09: optional comma-separated column list (e.g.
      // columns=studentId,dob,feesOwed). Unknown keys are dropped and the
      // result is capped server-side; name/NO. are always printed.
      const rawColumns = Array.isArray(req.query.columns)
        ? req.query.columns.join(',')
        : typeof req.query.columns === 'string'
          ? req.query.columns
          : undefined;
      const columns = normalizeClassListColumns(rawColumns);
      const data = await this.studentService.getClassListForPdf(classId);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(renderClassListPrintHtml(data, columns));
    } catch (error) { next(error); }
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

  /**
   * Advisory family lookup for the enrollment wizard. The response is never
   * a discount decision; staff must confirm the selected students before the
   * enrollment service attaches the new ward to a family group.
   */
  public getFamilyMatches = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const phone = typeof req.query.phone === 'string' ? req.query.phone : undefined;
      const email = typeof req.query.email === 'string' ? req.query.email : undefined;
      const matches = await this.studentService.getFamilyMatches(phone, email);
      return res.status(200).json({ success: true, data: matches });
    } catch (error) {
      next(error);
    }
  };

  public enrollStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const {
        account,
        demographics,
        placement,
        compliance,
        billing,
        payroll,
        guardian,
        parent,
        guardian2,
        familyMatchConfirmed,
        familyMatchStudentIds,
        familyGroupStartConfirmed,
        applyFamilyDiscount,
        familyDiscountReason,
      } = req.body;

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
        guardian2,
        familyMatchConfirmed,
        familyMatchStudentIds,
        familyGroupStartConfirmed,
        applyFamilyDiscount,
        familyDiscountReason,
        approvedBy: req.user?.sub ?? null,
        billing: billing || payroll,
      });

      return res.status(201).json({
        success: true,
        message: "Student enrollment pipeline complete.",
        data: {
          id: newStudent.id,
          studentId: newStudent.studentId,
          studentName: newStudent.studentName,
          // Set only when an initial deposit was recorded during enrollment
          // (band path); the enrollment UI shows the receipt + print button.
          ...(newStudent.depositReceipt ? { depositReceipt: newStudent.depositReceipt } : {}),
          familyEnrollment: newStudent.familyEnrollment,
        },
      });
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
