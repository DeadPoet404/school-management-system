import { Request, Response } from "express";
import { TeacherService } from "./teacher.service";

const teacherService = new TeacherService();

export class TeacherController {
  
  /**
   * GET /api/teachers
   * Fetches the formatted teacher entries directly from the database layer.
   */
  public getAllTeachers = async (req: Request, res: Response): Promise<Response> => {
    try {
      const teachers = await teacherService.getAllTeachers();
      
      return res.status(200).json({
        success: true, 
        data: teachers, 
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch operations.",
      });
    }
  };

  /**
   * POST /api/teachers
   * Validates the composite UI configuration object and delegates to the Service layer.
   */
  public createTeacher = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { account, placement } = req.body;

      // Validate the minimum necessary requirements for identity creation
      if (!account?.fullName || !account?.email) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing core identity payloads (fullName and email are required)." 
        });
      }

      // Delegate ID generation and DB commit entirely to the Service
      const newTeacher = await teacherService.createTeacher(req.body);

      return res.status(201).json({
        success: true,
        teacherId: newTeacher.teacherId,
        name: newTeacher.teacherName,
        message: "Faculty profile saved to database successfully."
      });

    } catch (error: any) {
      // Catch unique constraint violations from Prisma (e.g., duplicate emails)
      if (error.code === "P2002") {
        return res.status(409).json({ 
          success: false, 
          message: "A teacher with this email address already exists in the registry." 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  };

  /**
   * POST /api/teachers/departure
   * Validates departure payload and delegates offboarding to the Service layer.
   */
  public executeDeparture = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { teacherId, departureType, effectiveDate, clearance, remarks } = req.body;

      // Fail-fast validation matching the exact structure sent by the React frontend
      if (
        !teacherId ||
        !departureType ||
        !effectiveDate ||
        !clearance?.academic ||
        !clearance?.treasury ||
        !remarks
      ) {
        return res.status(400).json({
          success: false,
          message: "Missing structural faculty departure payload dependencies.",
        });
      }

      // Delegate to the service method
      const result = await teacherService.processDeparture(req.body);

      return res.status(200).json({
        success: true,
        message: `Faculty departure pipeline finalized for ID: ${teacherId}`,
        data: result,
      });
    } catch (error: any) {
      // Return 404 if the teacher doesn't exist, otherwise 422 for logic errors
      const statusCode = error.message.includes("lookup failed") ? 404 : 422;
      return res.status(statusCode).json({
        success: false,
        message: error.message || "Faculty excision pipeline execution failed.",
      });
    }
  };
}