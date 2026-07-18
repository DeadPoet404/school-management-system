import { logger } from '@/lib/logger';
import { AttendanceStatus } from "@prisma/client";
import { AttendanceRepository } from "./attendance.repository";

interface AttendanceSubmission {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

export class AttendanceService {
  constructor(private attendanceRepo: AttendanceRepository = new AttendanceRepository()) {}

  /**
   * Commits a complete class attendance sheet atomically.
   * Delegates to repository's upsert-based bulk method.
   */
  async recordBulkAttendance(date: string, records: AttendanceSubmission[]) {
    const targetDate = new Date(date);

    return this.attendanceRepo.upsertBulkAttendance(
      records.map((record) => ({
        studentId: record.studentId,
        date: targetDate,
        status: record.status,
        remarks: record.remarks ?? null,
      }))
    );
  }

  /**
   * Compiles historical attendance rates for a student.
   *
   * FIXED: EXCUSED records are now correctly counted instead of being
   * silently misclassified as ABSENT. The repository now returns
   * excusedCount via a single GROUP BY query (previously 3 separate
   * COUNT queries with no EXCUSED support).
   */
  async getStudentAttendanceMetrics(studentId: string) {
    const { presentCount, absentCount, lateCount, excusedCount, totalCount } =
      await this.attendanceRepo.getStudentAttendanceCounts(studentId);

    const metrics: Record<AttendanceStatus, number> = {
      PRESENT: presentCount,
      ABSENT: absentCount,
      LATE: lateCount,
      EXCUSED: excusedCount,
    };

    const rate =
      totalCount > 0
        ? ((presentCount + lateCount) / totalCount) * 100
        : 100.0;

    return {
      totalRecords: totalCount,
      breakdown: metrics,
      rate: Math.round(rate * 100) / 100,
    };
  }

  /**
   * Processes a full section attendance submission in a single batch operation.
   *
   * TODO (Phase 3): classId is received but not yet validated against the
   * submitted studentIds. A teacher could submit attendance for students
   * not in the specified class. Fix requires querying Placement records
   * to verify each studentId belongs to the given classId before
   * calling recordBulkAttendance.
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

    await this.recordBulkAttendance(date, records);

    return {
      processedCount: records.length,
    };
  }
}
