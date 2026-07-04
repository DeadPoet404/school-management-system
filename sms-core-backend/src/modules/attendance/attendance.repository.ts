import { prisma } from "@/lib/prisma";

export class AttendanceRepository {
  /**
   * Bulk inserts attendance records for a section within a transaction context.
   */
  async recordBulkAttendance(
    records: { studentId: string; date: Date; status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"; remarks?: string }[],
    tx: any = prisma
  ) {
    // Using createMany for high-density performance matrix writes
    return tx.attendanceRecord.createMany({
      data: records,
    });
  }

  /**
   * Aggregates total counts of status entries for a single student to calculate metrics.
   */
  async getStudentAttendanceCounts(studentInternalId: string, tx: any = prisma) {
    const presentCount = await tx.attendanceRecord.count({
      where: { studentId: studentInternalId, status: "PRESENT" },
    });
    
    const lateCount = await tx.attendanceRecord.count({
      where: { studentId: studentInternalId, status: "LATE" },
    });

    const totalCount = await tx.attendanceRecord.count({
      where: { studentId: studentInternalId },
    });

    return { presentCount, lateCount, totalCount };
  }

  /**
   * Atomically synchronizes the calculated rate percentage onto the student profile record.
   */
  async updateStudentAttendanceRate(studentInternalId: string, rate: number, tx: any = prisma) {
    return tx.student.update({
      where: { id: studentInternalId },
      data: { attendanceRate: rate },
    });
  }
}