import { Request, Response, NextFunction } from "express";
import { AttendanceService } from "./attendance.service";

const attendanceService = new AttendanceService();

export class AttendanceController {
  /**
   * POST /api/attendance/section
   * Ingests a complete sheet list and maps updates transactionally.
   */
  public submitSectionAttendance = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { date, classId, records } = req.body;

      // Fail-fast parameters payload dependency checks
      if (!date || !classId || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Missing essential metrics or empty grid structural array payload dependencies.",
        });
      }

      const outcome = await attendanceService.processSectionAttendance(req.body);

      return res.status(200).json({
        success: true,
        message: "Attendance register committed and student metrics compiled successfully.",
        data: outcome,
      });
    } catch (error) {
      next(error); // Caught safely by globalErrorHandler
    }
  };
}