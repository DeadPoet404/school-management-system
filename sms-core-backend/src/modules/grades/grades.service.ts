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
        // PR2: TimetableConfiguration.sectionId stores Class.id (UUID), not Class.section (A/B).
        const isAllocated = await this.repo.findTeacherAllocation(
          requestingUser.entityInternalId,
          subject.name,
          classId,
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

  /**
   * D-07: the grades module was write-only - POST /submit with no GET
   * anywhere - so marks could be entered and never read back. No report
   * card, no term summary, no way to review a mis-entered score.
   *
   * Class/subject/term are not declared as Prisma relations on GradeRecord
   * (see the schema-drift finding), so rows are enriched with separate
   * lookups rather than an include.
   */
  private async decorateGradeRows(
    rows: Awaited<ReturnType<typeof prisma.gradeRecord.findMany>>,
  ) {
    const uniq = (values: string[]) =>
      Array.from(new Set(values.filter((v): v is string => Boolean(v))));

    const [students, subjects, classes, terms] = await Promise.all([
      prisma.student.findMany({
        where: { id: { in: uniq(rows.map((r) => r.studentId)) } },
        select: { id: true, studentId: true, studentName: true },
      }),
      prisma.subject.findMany({
        where: { id: { in: uniq(rows.map((r) => r.subjectId)) } },
        select: { id: true, name: true, code: true },
      }),
      prisma.class.findMany({
        where: { id: { in: uniq(rows.map((r) => r.classId)) } },
        select: { id: true, name: true, section: true },
      }),
      prisma.term.findMany({
        where: { id: { in: uniq(rows.map((r) => r.termId)) } },
        select: { id: true, name: true, academicYear: true },
      }),
    ]);

    const byId = <T extends { id: string }>(items: T[]) =>
      new Map(items.map((item) => [item.id, item]));
    const studentMap = byId(students);
    const subjectMap = byId(subjects);
    const classMap = byId(classes);
    const termMap = byId(terms);

    return rows.map((row) => ({
      id: row.id,
      student: studentMap.get(row.studentId) ?? null,
      subject: subjectMap.get(row.subjectId) ?? null,
      class: classMap.get(row.classId) ?? null,
      term: termMap.get(row.termId) ?? null,
      continuousAssessment: Number(row.continuousAssessment),
      examination: Number(row.examination),
      finalScore: Number(row.finalScore),
      letterGrade: row.letterGrade,
      gradePoints: Number(row.gradePoints),
      creditHours: row.creditHours ?? 3,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  /**
   * GET /api/grades - paginated gradebook, filterable by class, subject,
   * term and student.
   */
  async getGrades(
    filters: {
      classId?: string;
      subjectId?: string;
      termId?: string;
      studentId?: string;
    },
    skip: number,
    limit: number,
  ) {
    const where: {
      classId?: string;
      subjectId?: string;
      termId?: string;
      studentId?: string;
    } = {};
    if (filters.classId) where.classId = filters.classId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.termId) where.termId = filters.termId;
    if (filters.studentId) where.studentId = filters.studentId;

    const [rows, total] = await Promise.all([
      prisma.gradeRecord.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.gradeRecord.count({ where }),
    ]);

    return { data: await this.decorateGradeRows(rows), total };
  }

  /**
   * GET /api/grades/student/:studentId - full transcript for one student,
   * optionally narrowed to a single term, with a recomputed weighted GPA.
   */
  async getStudentGradebook(studentInternalId: string, termId?: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentInternalId },
      select: {
        id: true,
        studentId: true,
        studentName: true,
        currentGpa: true,
      },
    });

    if (!student) {
      throw new AppError(404, `Student not found with ID: ${studentInternalId}`);
    }

    const where: { studentId: string; termId?: string } = {
      studentId: studentInternalId,
    };
    if (termId) where.termId = termId;

    const rows = await prisma.gradeRecord.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
    });
    const records = await this.decorateGradeRows(rows);

    let totalWeightedPoints = 0;
    let totalCreditHours = 0;
    for (const record of records) {
      totalWeightedPoints += record.gradePoints * record.creditHours;
      totalCreditHours += record.creditHours;
    }

    const weightedGpa =
      totalCreditHours > 0
        ? parseFloat((totalWeightedPoints / totalCreditHours).toFixed(2))
        : 0;

    return {
      student: {
        id: student.id,
        publicStudentId: student.studentId,
        studentName: student.studentName,
      },
      summary: {
        recordCount: records.length,
        totalCreditHours,
        weightedGpa,
        storedGpa: Number(student.currentGpa),
        termId: termId ?? null,
      },
      records,
    };
  }

  /**
   * D-07: correct an existing grade record in place.
   *
   * Grades are never deleted through the API - academic records are legally
   * significant, so a mistake is amended, not erased. Every call passes
   * through auditLog, which records actor, IP and the sanitised request body.
   */
  async correctGradeRecord(
    gradeRecordId: string,
    payload: {
      continuousAssessment?: number;
      examination?: number;
      creditHours?: number;
      reason?: string;
    },
    requestingUser?: JwtPayload,
  ) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.gradeRecord.findUnique({
        where: { id: gradeRecordId },
      });

      if (!existing) {
        throw new AppError(404, `Grade record not found with ID: ${gradeRecordId}`);
      }

      // Same allocation rule as submitMark: a teacher may only amend marks
      // for subject/class combinations they are assigned to.
      if (requestingUser?.role === "FACULTY" && requestingUser?.entityType === "TEACHER") {
        const [subject, klass] = await Promise.all([
          tx.subject.findUnique({ where: { id: existing.subjectId } }),
          tx.class.findUnique({ where: { id: existing.classId } }),
        ]);

        if (!subject || !klass) {
          throw new AppError(
            400,
            "This grade record references a subject or class that is no longer configured.",
          );
        }

        // PR2: allocation is keyed by Class.id via TimetableConfiguration.sectionId
        const isAllocated = await this.repo.findTeacherAllocation(
          requestingUser.entityInternalId,
          subject.name,
          existing.classId,
          tx,
        );

        if (!isAllocated) {
          throw new AppError(
            403,
            "You are not assigned to teach this subject in this class section.",
          );
        }
      }

      const continuousAssessment =
        payload.continuousAssessment ?? Number(existing.continuousAssessment);
      const examination = payload.examination ?? Number(existing.examination);
      const creditHours = payload.creditHours ?? existing.creditHours ?? 3;

      const finalScore = parseFloat((continuousAssessment + examination).toFixed(2));
      const { letterGrade, gradePoints } = this.calculateGradeMetrics(finalScore);

      const updated = await tx.gradeRecord.update({
        where: { id: gradeRecordId },
        data: {
          continuousAssessment,
          examination,
          finalScore,
          letterGrade,
          gradePoints,
          creditHours,
        },
      });

      // Recompute the weighted GPA from the corrected set.
      const allGrades = await this.repo.getAllStudentGrades(existing.studentId, tx);
      let totalWeightedPoints = 0;
      let totalCreditHours = 0;
      for (const item of allGrades) {
        const hours = item.creditHours ?? 3;
        totalWeightedPoints += Number(item.gradePoints) * hours;
        totalCreditHours += hours;
      }
      const compiledGpa =
        totalCreditHours > 0
          ? parseFloat((totalWeightedPoints / totalCreditHours).toFixed(2))
          : 0;
      await this.repo.updateStudentGpa(existing.studentId, compiledGpa, tx);

      return {
        id: updated.id,
        studentId: updated.studentId,
        before: {
          continuousAssessment: Number(existing.continuousAssessment),
          examination: Number(existing.examination),
          finalScore: Number(existing.finalScore),
          letterGrade: existing.letterGrade,
          gradePoints: Number(existing.gradePoints),
          creditHours: existing.creditHours ?? 3,
        },
        after: {
          continuousAssessment,
          examination,
          finalScore,
          letterGrade,
          gradePoints,
          creditHours,
        },
        recomputedGpa: compiledGpa,
        reason: payload.reason ?? null,
      };
    });
  }
}
