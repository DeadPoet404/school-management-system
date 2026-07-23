import { logger } from '@/lib/logger';
import { AttendanceStatus } from "@prisma/client";
import { AttendanceRepository } from "./attendance.repository";
import { AppError } from "@/middleware/error.handler";

interface AttendanceSubmission {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

export class AttendanceService {
  constructor(private attendanceRepo: AttendanceRepository = new AttendanceRepository()) {}

  /**
   * Commits a complete class attendance sheet atomically.
   * 1. Verifies every submitted studentId is actually placed in classId.
   * 2. Upserts each row in a single transaction.
   * 3. Recomputes + persists attendanceRate for every touched student.
   */
  async recordBulkAttendance(
    date: string,
    classId: string,
    records: AttendanceSubmission[],
  ) {
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new AppError(400, `Invalid attendance date: ${date}`);
    }

    // Validate class membership before any writes
    const submittedIds = records.map((r) => r.studentId);
    const uniqueIds = Array.from(new Set(submittedIds));
    const mismatched = await this.attendanceRepo.findMismatchedStudents(uniqueIds, classId);
    if (mismatched.length > 0) {
      throw new AppError(
        400,
        `The following student IDs are not placed in class ${classId}: ${mismatched.join(", ")}`,
      );
    }

    const upsertPayload = records.map((record) => ({
      studentId: record.studentId,
      date: targetDate,
      status: record.status,
      remarks: record.remarks ?? null,
    }));

    // Upsert rows and then recompute rates for each affected student
    const result = await this.attendanceRepo.upsertBulkAttendance(upsertPayload);

    for (const sid of uniqueIds) {
      const { presentCount, lateCount, totalCount } =
        await this.attendanceRepo.getStudentAttendanceCounts(sid);
      const rate =
        totalCount > 0 ? Math.round((((presentCount ?? 0) + (lateCount ?? 0)) / totalCount) * 10000) / 100 : 100.0;
      await this.attendanceRepo.updateStudentAttendanceRate(sid, rate);
    }

    return { processedCount: result.length, date: targetDate, classId };
  }

  /**
   * Compiles historical attendance rates for a student (single-student read).
   */
  async getStudentAttendanceMetrics(studentId: string) {
    const { presentCount, absentCount, lateCount, excusedCount, totalCount } =
      await this.attendanceRepo.getStudentAttendanceCounts(studentId);

    const metrics: Record<AttendanceStatus, number> = {
      PRESENT: presentCount ?? 0,
      ABSENT: absentCount ?? 0,
      LATE: lateCount ?? 0,
      EXCUSED: excusedCount ?? 0,
    };

    const rate =
      totalCount > 0 ? (((presentCount ?? 0) + (lateCount ?? 0)) / totalCount) * 100 : 100.0;

    return {
      totalRecords: totalCount,
      breakdown: metrics,
      rate: Math.round(rate * 100) / 100,
    };
  }

  /**
   * GET /class/:classId — returns roster of students in the class with any
   * attendance record already set for that date (used to render the sheet).
   */
  async getClassAttendanceSheet(classId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    if (isNaN(targetDate.getTime())) {
      throw new AppError(400, `Invalid date: ${date}`);
    }

    const [students, records] = await Promise.all([
      this.attendanceRepo.findStudentsInClass(classId),
      this.attendanceRepo.findByClassAndDate(classId, targetDate),
    ]);

    const recordByStudent = new Map(records.map((r) => [r.studentId, r]));

    const roster = students.map((s) => {
      const existing = recordByStudent.get(s.id);
      return {
        studentId: s.id,
        publicStudentId: s.studentId,
        studentName: s.studentName,
        status: existing?.status ?? null,
        remarks: existing?.remarks ?? null,
      };
    });

    return { classId, date: targetDate, roster };
  }

  async getStudentHistory(studentId: string, params: { from?: string; to?: string; limit: number }) {
    const from = params.from ? new Date(params.from) : undefined;
    const to = params.to ? new Date(params.to) : undefined;
    if (from && isNaN(from.getTime())) throw new AppError(400, `Invalid from date: ${params.from}`);
    if (to && isNaN(to.getTime())) throw new AppError(400, `Invalid to date: ${params.to}`);

    const [history, metrics] = await Promise.all([
      this.attendanceRepo.getStudentHistory(studentId, { from, to, limit: params.limit }),
      this.attendanceRepo.getStudentAttendanceCounts(studentId),
    ]);

    const rate =
      metrics.totalCount > 0
        ? Math.round((((metrics.presentCount ?? 0) + (metrics.lateCount ?? 0)) / metrics.totalCount) * 10000) / 100
        : 100.0;

    return { studentId, history, metrics: { ...metrics, rate } };
  }

  /**
   * Section-attendance endpoint entry — preserved for backwards compat.
   */
  async processSectionAttendance(payload: {
    date: string;
    classId: string;
    records: AttendanceSubmission[];
  }) {
    const { date, classId, records } = payload;

    logger.info(
      { classId, recordCount: records.length, date },
      '[Attendance] Processing section attendance submission'
    );

    return this.recordBulkAttendance(date, classId, records);
  }
}
