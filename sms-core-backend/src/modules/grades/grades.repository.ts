import { prisma } from "@/lib/prisma";
import { IGradesRepository, TransactionClient, GradeRecordUpsertData } from "@/types/repositories";

export class GradesRepository implements IGradesRepository {
  async upsertGradeRecord(data: GradeRecordUpsertData, tx: TransactionClient = prisma) {
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
        creditHours: data.creditHours ?? 3,
      },
      create: {
        ...data,
        creditHours: data.creditHours ?? 3,
      },
    });
  }

  // P2-9: Now selects creditHours alongside gradePoints for
  // weighted GPA calculation in the service layer.
  async getAllStudentGrades(studentInternalId: string, tx: TransactionClient = prisma) {
    return tx.gradeRecord.findMany({
      where: { studentId: studentInternalId },
      select: { gradePoints: true, creditHours: true },
    });
  }

  async updateStudentGpa(studentInternalId: string, gpa: number, tx: TransactionClient = prisma) {
    return tx.student.update({
      where: { id: studentInternalId },
      data: { currentGpa: gpa },
    });
  }
}
