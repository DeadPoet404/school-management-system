import { Request, Response, NextFunction } from "express";
import { StudentService } from "./student.service";

// ── LAYER INSTANTIATION ──
const studentService = new StudentService();

export class StudentController {
  /**
   * GET /api/students
   * Fetches full relational student graph rows mapped to UI grid standards.
   */
  public getAllStudents = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const students = await studentService.getAll();
      return res.status(200).json({ success: true, data: students });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/students/finance
   * Compiles the chronological ledger metrics matrix for billing.
   */
  public getFinancialMatrix = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const financialLedger = await studentService.getFinancialMatrix();
      return res.status(200).json({ success: true, data: financialLedger });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/students
   * Delegates unified transaction enrollment execution down to the Student Service layer.
   */
  public enrollStudent = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      // FIX: Destructure 'billing' (or fallback from 'payroll' if the frontend sent it under that key)
      const { account, demographics, placement, compliance, billing, payroll } = req.body;

      if (!account?.fullName || !account?.email) {
        return res.status(400).json({
          success: false,
          message: "Missing core identity payloads (fullName and email are required)."
        });
      }

      // FIX: Included 'billing' property to satisfy the strict StudentService signature contract
      const newStudent = await studentService.createStudent({
        account: {
          fullName: account.fullName,
          email: account.email,
          password: account.password,
          enrollmentDate: account.enrollmentDate || new Date().toISOString()
        },
        demographics,
        placement,
        compliance,
        billing: billing || payroll // Fallback strategy to absorb either naming option from the UI
      });

      return res.status(201).json({
        success: true,
        message: "Student enrollment pipeline complete.",
        data: {
          id: newStudent.id,
          studentId: newStudent.studentId,
          studentName: newStudent.studentName,
        },
      });
    } catch (error: any) {
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          message: "A student with this email or identifier already exists.",
        });
      }
      
      next(error);
    }
  };

  /**
   * POST /api/students/departure
   * Maps UI payload directly onto the student disposition system architecture.
   */
  public executeDeparture = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { studentId, departureType, effectiveDate, clearance, remarks } = req.body;

      if (!studentId || !departureType || !effectiveDate) {
        return res.status(400).json({
          success: false,
          message: "Missing core institutional student departure details.",
        });
      }

      const result = await studentService.processDeparture({
        studentId,
        departureType,
        effectiveDate,
        disposition: {
          destinationInstitution: clearance?.destinationInstitution || "None Provided",
          treasuryClearanceStatus: clearance?.treasury || "APPROVED",
          academicRecordsArchived: clearance?.academicRecordsArchived ?? true
        },
        remarks: remarks || "Standard Student Separation Sequence Finalized"
      });

      return res.status(200).json({
        success: true,
        message: `Departure processing finalized for ID: ${studentId}`,
        data: result,
      });
    } catch (error: any) {
      if (error.message?.includes("lookup failed") || error.message?.includes("not found")) {
        return res.status(404).json({
          success: false,
          message: error.message || "Student record could not be located.",
        });
      }
      
      return res.status(422).json({
        success: false,
        message: error.message || "Departure pipeline execution failed.",
      });
    }
  };
}