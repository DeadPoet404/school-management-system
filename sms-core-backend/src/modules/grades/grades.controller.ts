import { Request, Response, NextFunction } from "express";
import { GradesService } from "./grades.service";

const gradesService = new GradesService();

export class GradesController {
  /**
   * POST /api/grades/submit
   * Evaluates individual performance parameters and adjusts structural balances.
   */
  public submitMark = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { studentId, subjectId, classId, termId, continuousAssessment, examination } = req.body;

      // Fail-fast parameters structure assertion checks
      if (!studentId || !subjectId || !classId || !termId || continuousAssessment === undefined || examination === undefined) {
        return res.status(400).json({
          success: false,
          message: "Missing core entry structural metrics payload components.",
        });
      }

      const result = await gradesService.submitStudentMark(req.body);

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