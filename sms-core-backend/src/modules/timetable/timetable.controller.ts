import { Request, Response, NextFunction } from "express";
import { TimetableService } from "./timetable.service";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { resolveSessionStudentId } from "@/middleware/self-access";

export class TimetableController {
  constructor(private timetableService: TimetableService) {}

  public getMatrix = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentMatrix = await this.timetableService.getGlobalMatrix();
      return res.status(200).json({ success: true, data: currentMatrix });
    } catch (error) {
      next(error);
    }
  };

  /**
   * SMS-005: GET /api/timetable/me -- the session student's class schedule
   * (periods, breaks, subject-teacher allocations). Identity from JWT only.
   */
  public getOwnTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const studentId = resolveSessionStudentId(req.user);
      const data = await this.timetableService.getOwnTimetable(studentId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public saveMatrix = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fullMatrixPayload = req.body.data; 

      if (!fullMatrixPayload) {
        return res.status(400).json({ success: false, message: "Missing configuration matrix payload." });
      }

      await this.timetableService.replaceGlobalMatrix(fullMatrixPayload);

      return res.status(200).json({ success: true, message: "Timetable matrix snapshot initialized successfully." });
    } catch (error) {
      next(error);
    }
  };
}
