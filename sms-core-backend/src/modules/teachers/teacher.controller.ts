import { Request, Response, NextFunction } from "express";
import { TeacherService } from "./teacher.service";

const teacherService = new TeacherService();

export class TeacherController {
  
  /**
   * GET /api/teachers
   * Fetches the formatted teacher entries directly from the database layer.
   */
  public getAllTeachers = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const teachers = await teacherService.getAllTeachers();
      
      return res.status(200).json({
        success: true, 
        data: teachers, 
      });
    } catch (error) {
      next(error); // Delegated to global error handling pipeline
    }
  };

  /**
   * POST /api/teachers
   * Validates the composite UI configuration object and delegates to the Service layer.
   */
  public createTeacher = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { account, placement } = req.body;

      // Maintain fail-fast checks alongside your main Zod schema router guard
      if (!account?.fullName || !account?.email) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing core identity payloads (fullName and email are required)." 
        });
      }

      const newTeacher = await teacherService.createTeacher({
        account: {
          fullName: account.fullName,
          email: account.email
        },
        placement: placement ? {
          departmentId: placement.departmentId,
          jobTitle: placement.jobTitle,
          employmentType: placement.employmentType
        } : undefined
      });

      return res.status(201).json({
        success: true,
        teacherId: newTeacher.teacherId,
        name: newTeacher.teacherName,
        message: "Faculty profile saved to database successfully."
      });

    } catch (error) {
      next(error); // Interceptor automatically catches Prisma P2002 conflict codes
    }
  };

  /**
   * POST /api/teachers/departure
   * Validates departure payload and delegates offboarding to the Service layer.
   */
  public executeDeparture = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
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

      // Explicitly pass the expected payload map matching the updated service contract
      const result = await teacherService.processDeparture({
        teacherId,
        departureType,
        effectiveDate,
        clearance: {
          academic: clearance.academic,
          treasury: clearance.treasury
        },
        remarks
      });

      return res.status(200).json({
        success: true,
        message: `Faculty departure pipeline finalized for ID: ${teacherId}`,
        data: result,
      });
    } catch (error) {
      next(error); // Central error mapper handles uniform status codes (404/422/500)
    }
  };
}