import { logger } from '@/lib/logger';
import { prisma } from "@/lib/prisma";
import { AttendanceStatus } from "@prisma/client";
import { AttendanceRepository } from "./attendance.repository";
import { AppError } from "@/middleware/error.handler";
import { JwtPayload } from "@/types/auth.types";
import { ROLES } from "@/middleware/rbac.middleware";

interface AttendanceSubmission {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

export class AttendanceService {
  constructor(private attendanceRepo: AttendanceRepository = new AttendanceRepository()) {}

  /**
   * Commits a complete class attendance sheet atomically.
   * 1. Rejects duplicate studentIds in the payload.
   * 2. Verifies every submitted studentId is placed in classId.
   * 3. FACULTY must have a timetable allocation for this Class.id.
   * 4. Upserts rows + recomputes attendanceRate inside one transaction.
   */
  async recordBulkAttendance(
    date: string,
    classId: string,
    records: AttendanceSubmission[],
    requestingUser?: JwtPayload,
  ) {
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new AppError(400, `Invalid attendance date: ${date}`);
    }

    if (!classId?.trim()) {
      throw new AppError(400, "Class ID is required.");
    }

    const submittedIds = records.map((r) => r.studentId);
    const uniqueIds = Array.from(new Set(submittedIds));
    if (uniqueIds.length !== submittedIds.length) {
      throw new AppError(400, "Duplicate student IDs in attendance submission are not allowed.");
    }

    // Ensure class exists (canonical Class.id)
    const klass = await prisma.class.findFirst({
      where: { id: classId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!klass) {
      throw new AppError(400, `Unknown class id: ${classId}`);
    }

    // FACULTY must be allocated to this class via timetable (sectionId === Class.id)
    if (requestingUser?.role === ROLES.FACULTY && requestingUser.entityType === "TEACHER") {
      const allocation = await prisma.subjectAllocation.findFirst({
        where: {
          teacherId: requestingUser.entityInternalId,
          configuration: { sectionId: classId },
        },
        select: { id: true },
      });
      if (!allocation) {
        throw new AppError(
          403,
          "You are not assigned to teach this class. Attendance can only be marked for your timetable allocations.",
        );
      }
    }

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

    // Single transaction: all upserts + rate recompute, or none
    const result = await prisma.$transaction(async (tx) => {
      const written = await this.attendanceRepo.upsertBulkAttendance(upsertPayload, tx);

      for (const sid of uniqueIds) {
        const { presentCount, lateCount, totalCount } =
          await this.attendanceRepo.getStudentAttendanceCounts(sid, tx);
        const rate =
          totalCount > 0
            ? Math.round((((presentCount ?? 0) + (lateCount ?? 0)) / totalCount) * 10000) / 100
            : 100.0;
        await this.attendanceRepo.updateStudentAttendanceRate(sid, rate, tx);
      }

      return written;
    });

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

    const klass = await prisma.class.findFirst({
      where: { id: classId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!klass) {
      throw new AppError(404, `Class not found: ${classId}`);
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

    return { classId, className: klass.name, date: targetDate, roster };
  }

  async getStudentHistory(studentId: string, params: { from?: string; to?: string; limit: number }) {
    const from = params.from ? new Date(params.from) : undefined;
    const to = params.to ? new Date(params.to) : undefined;
    if (from && isNaN(from.getTime())) throw new AppError(400, `Invalid from date: ${params.from}`);
    if (to && isNaN(to.getTime())) throw new AppError(400, `Invalid to date: ${params.to}`);

    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { id: studentId },
          { studentId },
        ],
      },
      select: {
        id: true,
        studentId: true,
        studentName: true,
        attendanceRate: true,
        status: true,
        enrollmentDate: true,
        placement: true,
        demographics: true,
      },
    });

    if (!student) {
      throw new AppError(404, `Student not found with ID: ${studentId}`);
    }

    const [history, metrics] = await Promise.all([
      this.attendanceRepo.getStudentHistory(student.id, { from, to, limit: params.limit }),
      this.attendanceRepo.getStudentAttendanceCounts(student.id),
    ]);

    const rate =
      metrics.totalCount > 0
        ? Math.round((((metrics.presentCount ?? 0) + (metrics.lateCount ?? 0)) / metrics.totalCount) * 10000) / 100
        : 100.0;

    return {
      student: {
        id: student.id,
        studentId: student.studentId,
        studentName: student.studentName,
        attendanceRate: student.attendanceRate,
        status: student.status,
        enrollmentDate: student.enrollmentDate,
        placement: student.placement,
        demographics: student.demographics,
      },
      studentId: student.id,
      publicStudentId: student.studentId,
      history,
      metrics: { ...metrics, rate },
    };
  }

  /**
   * Corrects one existing attendance record without allowing PATCH to create
   * a new one. The global audit middleware records this write request.
   */
  async correctStudentAttendance(
    payload: {
      studentId: string;
      classId: string;
      date: string;
      status: AttendanceStatus;
      remarks?: string | null;
    },
    requestingUser?: JwtPayload,
  ) {
    const targetDate = new Date(payload.date);
    if (isNaN(targetDate.getTime())) {
      throw new AppError(400, `Invalid attendance date: ${payload.date}`);
    }

    if (requestingUser?.role === ROLES.FACULTY && requestingUser.entityType === "TEACHER") {
      const allocation = await prisma.subjectAllocation.findFirst({
        where: {
          teacherId: requestingUser.entityInternalId,
          configuration: { sectionId: payload.classId },
        },
        select: { id: true },
      });
      if (!allocation) {
        throw new AppError(
          403,
          "You are not assigned to teach this class. Attendance can only be corrected for your timetable allocations.",
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      const mismatched = await this.attendanceRepo.findMismatchedStudents(
        [payload.studentId],
        payload.classId,
        tx,
      );
      if (mismatched.length > 0) {
        throw new AppError(
          400,
          `Student ${payload.studentId} is not placed in class ${payload.classId}.`,
        );
      }

      const existing = await this.attendanceRepo.findByStudentAndDate(
        payload.studentId,
        targetDate,
        tx,
      );
      if (!existing) {
        throw new AppError(
          404,
          `No attendance record exists for student ${payload.studentId} on ${payload.date}.`,
        );
      }

      const updated = await this.attendanceRepo.updateAttendanceRecord(
        existing.id,
        { status: payload.status, remarks: payload.remarks },
        tx,
      );

      const { presentCount, lateCount, totalCount } =
        await this.attendanceRepo.getStudentAttendanceCounts(payload.studentId, tx);
      const rate =
        totalCount > 0
          ? Math.round((((presentCount ?? 0) + (lateCount ?? 0)) / totalCount) * 10000) / 100
          : 100.0;
      await this.attendanceRepo.updateStudentAttendanceRate(
        payload.studentId,
        rate,
        tx,
      );

      return { record: updated, attendanceRate: rate };
    });
  }

  /**
   * Section-attendance endpoint entry — preserved for backwards compat.
   */
  async processSectionAttendance(
    payload: {
      date: string;
      classId: string;
      records: AttendanceSubmission[];
    },
    requestingUser?: JwtPayload,
  ) {
    const { date, classId, records } = payload;

    logger.info(
      { classId, recordCount: records.length, date },
      '[Attendance] Processing section attendance submission'
    );

    return this.recordBulkAttendance(date, classId, records, requestingUser);
  }
}
