import { Request, Response, NextFunction } from "express";
import { GradesService } from "./grades.service";

export class GradesController {
  constructor(private gradesService: GradesService) {}

  public submitMark = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const result = await this.gradesService.submitStudentMark(req.body);

      return res.status(200).json({
        success: true,
        message: "Academic performance entry recorded and system GPA synchronized successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
