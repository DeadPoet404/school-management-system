import { AttendanceStatus } from "@prisma/client";
import { AttendanceRepository } from "./attendance.repository";

interface AttendanceSubmission {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

export class AttendanceService {
  // P2-6: Service now uses repository instead of direct prisma calls,
  // maintaining the Controller-Service-Repository architecture consistently
  // across all modules.
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
   * Delegates count queries to the repository.
   */
  async getStudentAttendanceMetrics(studentId: string) {
    const { presentCount, lateCount, totalCount } = await this.attendanceRepo.getStudentAttendanceCounts(studentId);

    const metrics: Record<AttendanceStatus, number> = {
      PRESENT: presentCount,
      ABSENT: totalCount - presentCount - lateCount,
      LATE: lateCount,
      EXCUSED: 0,
    };

    const rate =
      totalCount > 0
        ? ((presentCount + lateCount) / totalCount) * 100
        : 100.0;

    return {
      totalRecords: totalCount,
      breakdown: metrics,
      rate,
    };
  }

  /**
   * Processes a full section attendance submission in a single batch operation.
   */
  async processSectionAttendance(payload: {
    date: string;
    classId: string;
    records: AttendanceSubmission[];
  }) {
    const { date, records } = payload;

    await this.recordBulkAttendance(date, records);

    return {
      processedCount: records.length,
    };
  }
}
