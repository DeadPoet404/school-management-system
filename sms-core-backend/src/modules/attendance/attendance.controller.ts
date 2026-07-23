import { Request, Response, NextFunction } from "express";
import { AttendanceService } from "./attendance.service";
import { parsePaginationQuery } from "@/utils/pagination";

export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  public submitSectionAttendance = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { date, classId, records } = req.body;
      const outcome = await this.attendanceService.recordBulkAttendance(date, classId, records);
      return res.status(200).json({
        success: true,
        message: "Attendance register committed and student metrics compiled successfully.",
        data: outcome,
      });
    } catch (error) {
      next(error);
    }
  };

  public getClassSheet = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { classId } = req.params;
      const date = typeof req.query.date === "string" ? req.query.date : undefined;
      const sheet = await this.attendanceService.getClassAttendanceSheet(classId!, date);
      return res.status(200).json({ success: true, data: sheet });
    } catch (error) {
      next(error);
    }
  };

  public getStudentHistory = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { studentId } = req.params;
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;
      const limit = Math.min(
        200,
        Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
      );
      const history = await this.attendanceService.getStudentHistory(studentId!, { from, to, limit });
      return res.status(200).json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  };
}
