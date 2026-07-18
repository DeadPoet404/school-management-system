import { prisma } from "@/lib/prisma";
import { IAttendanceRepository, TransactionClient, AttendanceRecordCreateData } from "@/types/repositories";

export class AttendanceRepository implements IAttendanceRepository {
  async recordBulkAttendance(records: AttendanceRecordCreateData[], tx: TransactionClient = prisma) {
    return tx.attendanceRecord.createMany({ data: records });
  }

  // P2-6: Upsert-based bulk attendance — handles duplicate student+date
  // submissions gracefully (update existing, create new). Uses prisma
  // directly for $transaction since TransactionClient type doesn't
  // expose it — only PrismaClient does.
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

  async getStudentAttendanceCounts(studentInternalId: string, tx: TransactionClient = prisma) {
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

  async updateStudentAttendanceRate(studentInternalId: string, rate: number, tx: TransactionClient = prisma) {
    return tx.student.update({
      where: { id: studentInternalId },
      data: { attendanceRate: rate },
    });
  }
}
