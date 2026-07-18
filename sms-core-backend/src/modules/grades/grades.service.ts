import { prisma } from "@/lib/prisma";
import { IGradesRepository } from "@/types/repositories";
import { GradesRepository } from "./grades.repository";
import { resolveGrade } from "@/constants/grade-boundaries";
import { AppError } from "@/middleware/error.handler";
import { JwtPayload } from "@/types/auth.types";

export class GradesService {
  constructor(private repo: IGradesRepository = new GradesRepository()) {}

  private calculateGradeMetrics(score: number): { letterGrade: string; gradePoints: number } {
    return resolveGrade(score);
  }

  async submitStudentMark(
    payload: {
      studentId: string;
      subjectId: string;
      classId: string;
      termId: string;
      continuousAssessment: number;
      examination: number;
      creditHours?: number;
    },
    requestingUser?: JwtPayload,
  ) {
    const { studentId, subjectId, classId, termId, continuousAssessment, examination, creditHours } = payload;

    const finalScore = parseFloat((continuousAssessment + examination).toFixed(2));
    const { letterGrade, gradePoints } = this.calculateGradeMetrics(finalScore);

    return await prisma.$transaction(async (tx) => {
      // ── Authorization: FACULTY teachers must be allocated to this class+subject ──
      if (requestingUser?.role === "FACULTY" && requestingUser?.entityType === "TEACHER") {
        const [subject, klass] = await Promise.all([
          tx.subject.findUnique({ where: { id: subjectId } }),
          tx.class.findUnique({ where: { id: classId } }),
        ]);

        if (!subject) {
          throw new AppError(400, `Subject with ID "${subjectId}" does not exist.`);
        }
        if (!klass) {
          throw new AppError(400, `Class with ID "${classId}" does not exist.`);
        }
        if (!klass.section) {
          throw new AppError(400, `Class "${classId}" has no section assigned. Configure the timetable first.`);
        }

        const isAllocated = await this.repo.findTeacherAllocation(
          requestingUser.entityInternalId,
          subject.name,
          klass.section,
          tx,
        );

        if (!isAllocated) {
          throw new AppError(
            403,
            "You are not assigned to teach this subject in this class section.",
          );
        }
      }

      // ── Upsert grade record ──
      const updatedGrade = await this.repo.upsertGradeRecord(
        {
          studentId,
          subjectId,
          classId,
          termId,
          continuousAssessment,
          examination,
          finalScore,
          letterGrade,
          gradePoints,
          creditHours,
        },
        tx,
      );

      // ── Recalculate weighted GPA ──
      const allGrades = await this.repo.getAllStudentGrades(studentId, tx);

      if (allGrades.length > 0) {
        let totalWeightedPoints = 0;
        let totalCreditHours = 0;

        for (const item of allGrades) {
          const gp = Number(item.gradePoints);
          const ch = item.creditHours ?? 3;
          totalWeightedPoints += gp * ch;
          totalCreditHours += ch;
        }

        const compiledGpa =
          totalCreditHours > 0
            ? parseFloat((totalWeightedPoints / totalCreditHours).toFixed(2))
            : 0;

        await this.repo.updateStudentGpa(studentId, compiledGpa, tx);
      }

      return updatedGrade;
    });
  }
}
