import { Request, Response, NextFunction } from "express";
import { AttendanceService } from "./attendance.service";

export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  public submitSectionAttendance = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const outcome = await this.attendanceService.processSectionAttendance(req.body);

      return res.status(200).json({
        success: true,
        message: "Attendance register committed and student metrics compiled successfully.",
        data: outcome,
      });
    } catch (error) {
      next(error);
    }
  };
}
