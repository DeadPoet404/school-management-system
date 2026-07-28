import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { GradesService } from "./grades.service";
import {
  parsePaginationQuery,
  buildPaginationResponse,
} from "@/utils/pagination";
import { assertSelfOrPrivilegedStudentAccess } from "@/middleware/self-access";

export class GradesController {
  constructor(private gradesService: GradesService) {}

  public submitMark = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const result = await this.gradesService.submitStudentMark(req.body, req.user);

      return res.status(200).json({
        success: true,
        message: "Academic performance entry recorded and system GPA synchronized successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * D-07: GET /api/grades - paginated, filterable gradebook read.
   */
  public listGrades = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { page, limit, skip } = parsePaginationQuery(req.query);
      const filters = {
        classId:
          typeof req.query.classId === "string" ? req.query.classId : undefined,
        subjectId:
          typeof req.query.subjectId === "string"
            ? req.query.subjectId
            : undefined,
        termId:
          typeof req.query.termId === "string" ? req.query.termId : undefined,
        studentId:
          typeof req.query.studentId === "string"
            ? req.query.studentId
            : undefined,
      };

      const { data, total } = await this.gradesService.getGrades(
        filters,
        skip,
        limit,
      );

      return res.status(200).json(buildPaginationResponse(data, total, page, limit));
    } catch (error) {
      next(error);
    }
  };

  /**
   * D-07: GET /api/grades/student/:studentId - transcript plus GPA summary.
   */
  public getStudentGradebook = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { studentId } = req.params;

      // PR1 / issue 9: STUDENT may only read their own gradebook/transcript.
      assertSelfOrPrivilegedStudentAccess(req.user, studentId!);

      const termId =
        typeof req.query.termId === "string" ? req.query.termId : undefined;

      const gradebook = await this.gradesService.getStudentGradebook(
        studentId!,
        termId,
      );

      return res.status(200).json({ success: true, data: gradebook });
    } catch (error) {
      next(error);
    }
  };

  /**
   * D-07: PATCH /api/grades/:id - correct a mark, with audit trail.
   */
  public correctMark = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const { id } = req.params;
      const result = await this.gradesService.correctGradeRecord(
        id!,
        req.body,
        req.user,
      );

      return res.status(200).json({
        success: true,
        message: "Grade record corrected and student GPA recalculated.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
