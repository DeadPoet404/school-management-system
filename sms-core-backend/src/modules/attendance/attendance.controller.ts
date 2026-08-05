import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { AttendanceService } from "./attendance.service";
import { assertSelfOrPrivilegedStudentAccess, resolveSessionStudentId } from "@/middleware/self-access";

export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  public submitSectionAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { date, classId, records } = req.body;
      const outcome = await this.attendanceService.recordBulkAttendance(
        date,
        classId,
        records,
        req.user,
      );
      return res.status(200).json({
        success: true,
        message: "Attendance register committed and student metrics compiled successfully.",
        data: outcome,
      });
    } catch (error) {
      next(error);
    }
  };

  public correctStudentAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { studentId } = req.params;
      const { classId, date, status, remarks } = req.body;
      const outcome = await this.attendanceService.correctStudentAttendance(
        {
          studentId: studentId!,
          classId,
          date,
          status,
          remarks,
        },
        req.user,
      );

      return res.status(200).json({
        success: true,
        message: "Attendance record corrected and student attendance rate recalculated.",
        data: outcome,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * SMS-005: GET /api/attendance/me -- session-resolved attendance history
   * plus summary metrics. Same query contract as the param-keyed read.
   */
  public getOwnHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const studentId = resolveSessionStudentId(req.user);
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;
      const limit = Math.min(
        200,
        Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
      );
      const history = await this.attendanceService.getStudentHistory(studentId, { from, to, limit });
      return res.status(200).json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  };

  public getClassSheet = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { classId } = req.params;
      const date = typeof req.query.date === "string" ? req.query.date : undefined;
      const sheet = await this.attendanceService.getClassAttendanceSheet(classId!, date);
      return res.status(200).json({ success: true, data: sheet });
    } catch (error) {
      next(error);
    }
  };

  public getStudentHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { studentId } = req.params;

      // PR1 / issue 9: STUDENT may only read their own attendance history.
      assertSelfOrPrivilegedStudentAccess(req.user, studentId!);

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
