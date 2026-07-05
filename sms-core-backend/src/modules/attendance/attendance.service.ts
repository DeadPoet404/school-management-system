import { prisma } from "@/lib/prisma";
import { AttendanceStatus } from "@prisma/client";

interface AttendanceSubmission {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

export class AttendanceService {
  /**
   * Commits a complete class attendance sheet atomically.
   * Uses a single transaction batch (N upserts in one DB round-trip).
   */
  async recordBulkAttendance(date: string, records: AttendanceSubmission[]) {
    const targetDate = new Date(date);

    return await prisma.$transaction(
      records.map((record) =>
        prisma.attendanceRecord.upsert({
          where: {
            studentId_date: {
              studentId: record.studentId,
              date: targetDate,
            },
          },
          update: {
            status: record.status,
            remarks: record.remarks ?? null,
          },
          create: {
            studentId: record.studentId,
            date: targetDate,
            status: record.status,
            remarks: record.remarks ?? null,
          },
        })
      )
    );
  }

  /**
   * Compiles historical attendance rates for a student.
   */
  async getStudentAttendanceMetrics(studentId: string) {
    const summary = await prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { studentId },
      _count: { status: true },
    });

    const metrics: Record<AttendanceStatus, number> = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    };

    let total = 0;

    summary.forEach((group) => {
      metrics[group.status] = group._count.status;
      total += group._count.status;
    });

    const rate =
      total > 0
        ? ((metrics.PRESENT + metrics.LATE) / total) * 100
        : 100.0;

    return {
      totalRecords: total,
      breakdown: metrics,
      rate,
    };
  }

  /**
   * Processes a full section attendance submission in a single batch operation.
   * Replaces per-student loops with atomic bulk upserts.
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