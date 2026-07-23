import { prisma } from "@/lib/prisma";
import type { AttendanceStatus } from "@prisma/client";
import { IAttendanceRepository, TransactionClient, AttendanceRecordCreateData } from "@/types/repositories";

export class AttendanceRepository implements IAttendanceRepository {
  async recordBulkAttendance(records: AttendanceRecordCreateData[], tx: TransactionClient = prisma) {
    return tx.attendanceRecord.createMany({ data: records });
  }

  /**
   * Upsert-based bulk attendance — handles duplicate student+date
   * submissions gracefully (update existing, create new).
   */
  async upsertBulkAttendance(
    records: Array<{ studentId: string; date: Date; status: AttendanceStatus; remarks?: string | null }>,
    tx: TransactionClient = prisma,
  ) {
    // If a tx is supplied, run upserts sequentially through it; otherwise open our own.
    const run = tx ?? prisma;
    const results = [];
    for (const record of records) {
      const r = await run.attendanceRecord.upsert({
        where: {
          studentId_date: {
            studentId: record.studentId,
            date: record.date,
          },
        },
        update: {
          status: record.status,
          remarks: record.remarks ?? null,
        },
        create: {
          studentId: record.studentId,
          date: record.date,
          status: record.status,
          remarks: record.remarks ?? null,
        },
      });
      results.push(r);
    }
    return results;
  }

  /**
   * Returns all attendance rows for a given class on a given date,
   * joined with the student's public id + name for UI rendering.
   */
  async findByClassAndDate(classId: string, date: Date, tx: TransactionClient = prisma) {
    return tx.attendanceRecord.findMany({
      where: {
        date,
        student: {
          placement: { classId },
          status: { not: "DEPARTED" },
        },
      },
      include: {
        student: { select: { id: true, studentId: true, studentName: true } },
      },
      orderBy: { student: { studentName: "asc" } },
    });
  }

  /**
   * Returns all active students placed in a class (used to seed the
   * attendance sheet on the UI before any records are committed).
   */
  async findStudentsInClass(classId: string, tx: TransactionClient = prisma) {
    return tx.student.findMany({
      where: { placement: { classId }, status: { not: "DEPARTED" } },
      select: { id: true, studentId: true, studentName: true },
      orderBy: { studentName: "asc" },
    });
  }

  /**
   * Verify that a set of studentIds all belong to the given classId.
   * Returns the list of IDs that are NOT placed in that class.
   */
  async findMismatchedStudents(studentIds: string[], classId: string, tx: TransactionClient = prisma) {
    if (studentIds.length === 0) return [];
    const placed = await tx.student.findMany({
      where: { id: { in: studentIds }, placement: { classId } },
      select: { id: true },
    });
    const placedSet = new Set(placed.map((s) => s.id));
    return studentIds.filter((id) => !placedSet.has(id));
  }

  /**
   * Attendance counts grouped by status, plus total.
   */
  async getStudentAttendanceCounts(studentInternalId: string, tx: TransactionClient = prisma) {
    const groups = await tx.attendanceRecord.groupBy({
      by: ["status"],
      where: { studentId: studentInternalId },
      _count: { status: true },
    });

    const counts: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    let totalCount = 0;
    for (const group of groups) {
      const status = group.status as string;
      counts[status] = group._count.status;
      totalCount += group._count.status;
    }

    return {
      presentCount: counts.PRESENT,
      absentCount: counts.ABSENT,
      lateCount: counts.LATE,
      excusedCount: counts.EXCUSED,
      totalCount,
    };
  }

  async getStudentHistory(
    studentInternalId: string,
    params: { from?: Date; to?: Date; limit: number },
    tx: TransactionClient = prisma,
  ) {
    const where: any = { studentId: studentInternalId };
    if (params.from || params.to) {
      where.date = {};
      if (params.from) where.date.gte = params.from;
      if (params.to) where.date.lte = params.to;
    }
    return tx.attendanceRecord.findMany({
      where,
      orderBy: { date: "desc" },
      take: params.limit,
    });
  }

  async updateStudentAttendanceRate(studentInternalId: string, rate: number, tx: TransactionClient = prisma) {
    return tx.student.update({
      where: { id: studentInternalId },
      data: { attendanceRate: rate },
    });
  }
}
