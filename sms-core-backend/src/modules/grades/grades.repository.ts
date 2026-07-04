import { prisma } from "@/lib/prisma";

export class GradesRepository {
  /**
   * Commits or updates an academic grade record entry.
   */
  async upsertGradeRecord(
    data: {
      studentId: string;
      subjectId: string;
      classId: string;
      termId: string;
      continuousAssessment: number;
      examination: number;
      finalScore: number;
      letterGrade: string;
      gradePoints: number;
    },
    tx: any = prisma
  ) {
    return tx.gradeRecord.upsert({
      where: {
        studentId_subjectId_termId: {
          studentId: data.studentId,
          subjectId: data.subjectId,
          termId: data.termId,
        },
      },
      update: {
        continuousAssessment: data.continuousAssessment,
        examination: data.examination,
        finalScore: data.finalScore,
        letterGrade: data.letterGrade,
        gradePoints: data.gradePoints,
      },
      create: data,
    });
  }

  /**
   * Fetches all active grade point entries for a specific student to compile cumulative metrics.
   */
  async getStudentTermGrades(studentInternalId: string, termId: string, tx: any = prisma) {
    return tx.gradeRecord.findMany({
      where: { studentId: studentInternalId, termId },
      select: { gradePoints: true },
    });
  }

  /**
   * Persists the computed GPA balance calculation onto the parent student record.
   */
  async updateStudentGpa(studentInternalId: string, gpa: number, tx: any = prisma) {
    return tx.student.update({
      where: { id: studentInternalId },
      data: { currentGpa: gpa },
    });
  }
}