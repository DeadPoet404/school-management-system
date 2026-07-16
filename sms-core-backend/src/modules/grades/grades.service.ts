import { prisma } from "@/lib/prisma";
import { IGradesRepository } from "@/types/repositories";
import { GradesRepository } from "./grades.repository";

export class GradesService {
  constructor(private repo: IGradesRepository = new GradesRepository()) {}

  private calculateGradeMetrics(score: number): { letterGrade: string; gradePoints: number } {
    if (score >= 80) return { letterGrade: "A", gradePoints: 4.0 };
    if (score >= 75) return { letterGrade: "B+", gradePoints: 3.5 };
    if (score >= 70) return { letterGrade: "B", gradePoints: 3.0 };
    if (score >= 65) return { letterGrade: "C+", gradePoints: 2.5 };
    if (score >= 60) return { letterGrade: "C", gradePoints: 2.0 };
    if (score >= 50) return { letterGrade: "D", gradePoints: 1.0 };
    return { letterGrade: "F", gradePoints: 0.0 };
  }

  async submitStudentMark(payload: {
    studentId: string;
    subjectId: string;
    classId: string;
    termId: string;
    continuousAssessment: number;
    examination: number;
  }) {
    const { studentId, subjectId, classId, termId, continuousAssessment, examination } = payload;

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
      }, tx);

      const allGrades = await this.repo.getAllStudentGrades(studentId, tx);

      if (allGrades.length > 0) {
        const totalPoints = allGrades.reduce((sum: number, item: { gradePoints: number }) => sum + item.gradePoints, 0);
        const compiledGpa = parseFloat((totalPoints / allGrades.length).toFixed(2));
        await this.repo.updateStudentGpa(studentId, compiledGpa, tx);
      }

      return updatedGrade;
    });
  }
}
