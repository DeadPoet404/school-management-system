import { prisma } from "@/lib/prisma";
import { IGradesRepository } from "@/types/repositories";
import { GradesRepository } from "./grades.repository";
import { resolveGrade } from "@/constants/grade-boundaries";

export class GradesService {
  constructor(private repo: IGradesRepository = new GradesRepository()) {}

  private calculateGradeMetrics(score: number): { letterGrade: string; gradePoints: number } {
    return resolveGrade(score);
  }

  async submitStudentMark(payload: {
    studentId: string;
    subjectId: string;
    classId: string;
    termId: string;
    continuousAssessment: number;
    examination: number;
    creditHours?: number;
  }) {
    const { studentId, subjectId, classId, termId, continuousAssessment, examination, creditHours } = payload;

    const finalScore = parseFloat((continuousAssessment + examination).toFixed(2));
    const { letterGrade, gradePoints } = this.calculateGradeMetrics(finalScore);

    return await prisma.$transaction(async (tx) => {
      const updatedGrade = await this.repo.upsertGradeRecord({
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
      }, tx);

      const allGrades = await this.repo.getAllStudentGrades(studentId, tx);

      if (allGrades.length > 0) {
        // P2-9: Weighted GPA calculation.
        // Old: Σ(gradePoints) / count — treats 2-credit and 4-credit equally
        // New: Σ(gradePoints × creditHours) / Σ(creditHours) — correct weighting
        let totalWeightedPoints = 0;
        let totalCreditHours = 0;

        for (const item of allGrades) {
          const gp = Number(item.gradePoints);
          const ch = item.creditHours ?? 3;
          totalWeightedPoints += gp * ch;
          totalCreditHours += ch;
        }

        const compiledGpa = totalCreditHours > 0
          ? parseFloat((totalWeightedPoints / totalCreditHours).toFixed(2))
          : 0;

        await this.repo.updateStudentGpa(studentId, compiledGpa, tx);
      }

      return updatedGrade;
    });
  }
}
