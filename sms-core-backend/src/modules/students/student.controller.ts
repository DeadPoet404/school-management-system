import { Request, Response, NextFunction } from "express";
import { StudentService } from "./student.service";
import { parsePaginationQuery, buildPaginationResponse } from "@/utils/pagination";

export class StudentController {
  constructor(private studentService: StudentService) {}

  public getAllStudents = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { page, limit, skip } = parsePaginationQuery(req.query);
      const { data, total } = await this.studentService.getPaginated(skip, limit);
      return res.status(200).json(buildPaginationResponse(data, total, page, limit));
    } catch (error) {
      next(error);
    }
  };

  public getFinancialMatrix = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const financialLedger = await this.studentService.getFinancialMatrix();
      return res.status(200).json({ success: true, data: financialLedger });
    } catch (error) {
      next(error);
    }
  };

  public enrollStudent = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { account, demographics, placement, compliance, billing, payroll } = req.body;

      if (!account?.fullName || !account?.email) {
        return res.status(400).json({ success: false, message: "Missing core identity payloads (fullName and email are required)." });
      }

      const newStudent = await this.studentService.createStudent({
        account: { fullName: account.fullName, email: account.email, password: account.password, enrollmentDate: account.enrollmentDate || new Date().toISOString() },
        demographics, placement, compliance,
        billing: billing || payroll,
      });

      return res.status(201).json({ success: true, message: "Student enrollment pipeline complete.", data: { id: newStudent.id, studentId: newStudent.studentId, studentName: newStudent.studentName } });
    } catch (error) {
      next(error);
    }
  };

  public executeDeparture = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { studentId, departureType, effectiveDate, clearance, remarks } = req.body;

      if (!studentId || !departureType || !effectiveDate) {
        return res.status(400).json({ success: false, message: "Missing core institutional student departure details." });
      }

      const result = await this.studentService.processDeparture({
        studentId, departureType, effectiveDate,
        disposition: { destinationInstitution: clearance?.destinationInstitution || "None Provided", treasuryClearanceStatus: clearance?.treasury || "APPROVED", academicRecordsArchived: clearance?.academicRecordsArchived ?? true },
        remarks: remarks || "Standard Student Separation Sequence Finalized",
      });

      return res.status(200).json({ success: true, message: `Departure processing finalized for ID: ${studentId}`, data: result });
    } catch (error) {
      next(error);
    }
  };

  public updateStudent = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { id } = req.params;
      const updated = await this.studentService.update(id, req.body);
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

}
