import { prisma } from "@/lib/prisma";
import { GradesRepository } from "./grades.repository";

export class GradesService {
  private repo = new GradesRepository();

  /**
   * Helper to transform a numerical score into a standard 4.0 GPA point map and letter grade.
   */
  private calculateGradeMetrics(score: number): { letterGrade: string; gradePoints: number } {
    if (score >= 80) return { letterGrade: "A", gradePoints: 4.0 };
    if (score >= 75) return { letterGrade: "B+", gradePoints: 3.5 };
    if (score >= 70) return { letterGrade: "B", gradePoints: 3.0 };
    if (score >= 65) return { letterGrade: "C+", gradePoints: 2.5 };
    if (score >= 60) return { letterGrade: "C", gradePoints: 2.0 };
    if (score >= 50) return { letterGrade: "D", gradePoints: 1.0 };
    return { letterGrade: "F", gradePoints: 0.0 };
  }

  /**
   * Processes score submissions, aggregates term performance, and updates student GPA.
   */
  async submitStudentMark(payload: {
    studentId: string;
    subjectId: string;
    classId: string;
    termId: string;
    continuousAssessment: number; // Max 40
    examination: number;          // Max 60
  }) {
    const { studentId, subjectId, classId, termId, continuousAssessment, examination } = payload;

    // Run structural calculation weights (40% CA + 60% Exam)
    const finalScore = parseFloat((continuousAssessment + examination).toFixed(2));
    const { letterGrade, gradePoints } = this.calculateGradeMetrics(finalScore);

    return await prisma.$transaction(async (tx) => {
      // 1. Commit or update the specific grade row entry
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

      // 2. Fetch all term records for the student to run rolling GPA compilation arrays
      const allGrades = await this.repo.getStudentTermGrades(studentId, termId, tx);

      if (allGrades.length > 0) {
        // ✅ FIXED: Add explicit types for the accumulator (number) and the collection items
const totalPoints = allGrades.reduce((sum: number, item: { gradePoints: number }) => sum + item.gradePoints, 0);
        const compiledGpa = parseFloat((totalPoints / allGrades.length).toFixed(2));

        // 3. Update the calculated metric onto the student's core entity row
        await this.repo.updateStudentGpa(studentId, compiledGpa, tx);
      }

      return updatedGrade;
    });
  }
}