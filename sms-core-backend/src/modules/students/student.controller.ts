import { Request, Response } from "express";
import { StudentService } from "./student.service";

// ── LAYER INSTANTIATION ──
// The controller only talks to the Service layer. It does not touch the database.
const studentService = new StudentService();

export class StudentController {
  /**
   * Fetches full relational student graph rows.
   * Maps to GET /api/students
   */
  public getAllStudents = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const students = await studentService.getAll();
      return res.status(200).json({ success: true, data: students });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve student records.",
      });
    }
  };

  /**
   * Compiles the chronological ledger metrics matrix.
   * Maps to GET /api/students/finance
   */
  public getFinancialMatrix = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const financialLedger = await studentService.getFinancialMatrix();
      return res.status(200).json({ success: true, data: financialLedger });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to calculate financial history.",
      });
    }
  };

  /**
   * Validates incoming payload and delegates enrollment to the Service layer.
   * Maps to POST /api/students
   */
  public enrollStudent = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const { account, demographics, placement, guardian, billing } = req.body;

      // Fail-fast validation for required frontend fields
      if (
        !account?.fullName || !account?.email || !account?.password || !account?.enrollmentDate ||
        !demographics?.dateOfBirth || !demographics?.gender || !demographics?.residentialAddress ||
        !placement?.classId || !placement?.academicTrack || !placement?.boardingStatus ||
        !guardian?.name || !guardian?.relationship || !guardian?.phone ||
        !billing?.feeTierId
      ) {
        return res.status(400).json({
          success: false,
          message: "Missing essential enrollment payload dependencies.",
        });
      }

      // Delegate the database transaction entirely to the Service
      const newStudent = await studentService.createStudent(req.body);

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
      // Catch Prisma unique constraint violations (e.g., duplicate email/ID)
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          message: "A student with this email or identifier already exists.",
        });
      }
      
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to execute enrollment pipeline.",
      });
    }
  };

  /**
   * Validates departure payload and delegates offboarding to the Service layer.
   * Maps to POST /api/students/departure
   */
  public executeDeparture = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const { studentId, departureType, effectiveDate, disposition, remarks } = req.body;

      // Validate the exact structure sent by the React frontend
      if (
        !studentId ||
        !departureType ||
        !effectiveDate ||
        !disposition?.treasuryClearanceStatus ||
        disposition?.destinationInstitution === undefined ||
        disposition?.academicRecordsArchived === undefined ||
        !remarks
      ) {
        return res.status(400).json({
          success: false,
          message: "Missing structural departure payload dependencies.",
        });
      }

      // Delegate to the service method
      const result = await studentService.processDeparture(req.body);

      return res.status(200).json({
        success: true,
        message: `Departure processing finalized for ID: ${studentId}`,
        data: result,
      });
    } catch (error: any) {
      // Return 404 if the student doesn't exist, otherwise 422 for logic errors
      const statusCode = error.message.includes("lookup failed") ? 404 : 422;
      return res.status(statusCode).json({
        success: false,
        message: error.message || "Departure pipeline execution failed.",
      });
    }
  };
}