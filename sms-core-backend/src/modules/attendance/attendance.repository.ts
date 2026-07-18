import { prisma } from "@/lib/prisma";
import { IAttendanceRepository, TransactionClient, AttendanceRecordCreateData } from "@/types/repositories";

export class AttendanceRepository implements IAttendanceRepository {
  async recordBulkAttendance(records: AttendanceRecordCreateData[], tx: TransactionClient = prisma) {
    return tx.attendanceRecord.createMany({ data: records });
  }

  /**
   * Upsert-based bulk attendance — handles duplicate student+date
   * submissions gracefully (update existing, create new). Uses prisma
   * directly for $transaction since TransactionClient type doesn't
   * expose it — only PrismaClient does.
   */
  async upsertBulkAttendance(records: Array<{ studentId: string; date: Date; status: string; remarks?: string | null }>) {
    return prisma.$transaction(
      records.map((record) =>
        prisma.attendanceRecord.upsert({
          where: {
            studentId_date: {
              studentId: record.studentId,
              date: record.date,
            },
          },
          update: {
            status: record.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
            remarks: record.remarks ?? null,
          },
          create: {
            studentId: record.studentId,
            date: record.date,
            status: record.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
            remarks: record.remarks ?? null,
          },
        })
      )
    );
  }

  /**
   * Gets attendance counts grouped by status in a single query.
   *
   * Previous implementation used 3 separate COUNT queries (PRESENT, LATE, total).
   * This GROUP BY approach returns all status counts in one database round-trip
   * and includes the previously-missing EXCUSED count.
   *
   * Returns a Record<AttendanceStatus, number> where missing statuses default to 0,
   * plus a totalCount for convenience.
   */
  async getStudentAttendanceCounts(studentInternalId: string, _tx?: TransactionClient) {
    // GROUP BY is more efficient than N separate COUNT queries.
    // Note: We use prisma directly (not tx) because groupBy may not be
    // available on all TransactionClient types depending on Prisma version.
    const groups = await prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { studentId: studentInternalId },
      _count: { status: true },
    });

    const counts: Record<string, number> = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    };

    let totalCount = 0;
    for (const group of groups) {
      const status = group.status as string;
      const count = group._count.status;
      counts[status] = count;
      totalCount += count;
    }

    return {
      presentCount: counts.PRESENT,
      absentCount: counts.ABSENT,
      lateCount: counts.LATE,
      excusedCount: counts.EXCUSED,
      totalCount,
    };
  }

  async updateStudentAttendanceRate(studentInternalId: string, rate: number, tx: TransactionClient = prisma) {
    return tx.student.update({
      where: { id: studentInternalId },
      data: { attendanceRate: rate },
    });
  }
}
