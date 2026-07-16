import { prisma } from "@/lib/prisma";
import { IAttendanceRepository, TransactionClient, AttendanceRecordCreateData } from "@/types/repositories";

export class AttendanceRepository implements IAttendanceRepository {
  async recordBulkAttendance(records: AttendanceRecordCreateData[], tx: TransactionClient = prisma) {
    return tx.attendanceRecord.createMany({ data: records });
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
