/* eslint-disable @typescript-eslint/no-explicit-any -- repository test doubles are partial */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    class: { findFirst: vi.fn() },
    subjectAllocation: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { AttendanceService } from "@/modules/attendance/attendance.service";

describe("AttendanceService.correctStudentAttendance", () => {
  let repo: any;
  let service: AttendanceService;

  beforeEach(() => {
    repo = {
      findMismatchedStudents: vi.fn().mockResolvedValue([]),
      findByStudentAndDate: vi.fn().mockResolvedValue({
        id: "attendance-1",
        studentId: "student-1",
        date: new Date("2026-07-27"),
        status: "ABSENT",
        remarks: null,
      }),
      updateAttendanceRecord: vi.fn().mockResolvedValue({
        id: "attendance-1",
        studentId: "student-1",
        status: "PRESENT",
        remarks: "Arrived after registration",
      }),
      getStudentAttendanceCounts: vi.fn().mockResolvedValue({
        presentCount: 8,
        absentCount: 1,
        lateCount: 1,
        excusedCount: 0,
        totalCount: 10,
      }),
      updateStudentAttendanceRate: vi.fn().mockResolvedValue({}),
      upsertBulkAttendance: vi.fn(),
    };

    service = new AttendanceService(repo);
    vi.clearAllMocks();
    (prisma.$transaction as any).mockImplementation(async (callback: any) => callback({}));
    (prisma.class.findFirst as any).mockResolvedValue({ id: "class-1", name: "JHS 1A" });
    (prisma.subjectAllocation.findFirst as any).mockResolvedValue({ id: "alloc-1" });
  });

  it("updates an existing record and recalculates the attendance rate", async () => {
    const result = await service.correctStudentAttendance({
      studentId: "student-1",
      classId: "class-1",
      date: "2026-07-27",
      status: "PRESENT",
      remarks: "Arrived after registration",
    });

    expect(repo.findMismatchedStudents).toHaveBeenCalledWith(
      ["student-1"],
      "class-1",
      expect.anything(),
    );
    expect(repo.findByStudentAndDate).toHaveBeenCalledWith(
      "student-1",
      expect.any(Date),
      expect.anything(),
    );
    expect(repo.updateAttendanceRecord).toHaveBeenCalledWith(
      "attendance-1",
      { status: "PRESENT", remarks: "Arrived after registration" },
      expect.anything(),
    );
    expect(repo.updateStudentAttendanceRate).toHaveBeenCalledWith(
      "student-1",
      90,
      expect.anything(),
    );
    expect(result.attendanceRate).toBe(90);
    expect(result.record.status).toBe("PRESENT");
  });

  it("rejects a correction when no attendance record exists for that date", async () => {
    repo.findByStudentAndDate.mockResolvedValue(null);

    await expect(
      service.correctStudentAttendance({
        studentId: "student-1",
        classId: "class-1",
        date: "2026-07-27",
        status: "PRESENT",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining("No attendance record exists"),
    });

    expect(repo.updateAttendanceRecord).not.toHaveBeenCalled();
    expect(repo.updateStudentAttendanceRate).not.toHaveBeenCalled();
  });

  it("rejects a correction when the student is not in the supplied class", async () => {
    repo.findMismatchedStudents.mockResolvedValue(["student-1"]);

    await expect(
      service.correctStudentAttendance({
        studentId: "student-1",
        classId: "class-1",
        date: "2026-07-27",
        status: "PRESENT",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("not placed in class"),
    });

    expect(repo.findByStudentAndDate).not.toHaveBeenCalled();
    expect(repo.updateAttendanceRecord).not.toHaveBeenCalled();
  });
});

describe("AttendanceService.recordBulkAttendance (PR3)", () => {
  let repo: any;
  let service: AttendanceService;

  const faculty = {
    sub: "acc-t",
    email: "t@school.com",
    role: "FACULTY",
    entityType: "TEACHER" as const,
    entityInternalId: "tch-1",
  };

  beforeEach(() => {
    repo = {
      findMismatchedStudents: vi.fn().mockResolvedValue([]),
      upsertBulkAttendance: vi.fn().mockResolvedValue([{ id: "a1" }, { id: "a2" }]),
      getStudentAttendanceCounts: vi.fn().mockResolvedValue({
        presentCount: 1,
        lateCount: 0,
        totalCount: 1,
        absentCount: 0,
        excusedCount: 0,
      }),
      updateStudentAttendanceRate: vi.fn().mockResolvedValue({}),
    };
    service = new AttendanceService(repo);
    vi.clearAllMocks();
    (prisma.$transaction as any).mockImplementation(async (callback: any) => callback({}));
    (prisma.class.findFirst as any).mockResolvedValue({ id: "class-uuid", name: "JHS 1A" });
    (prisma.subjectAllocation.findFirst as any).mockResolvedValue({ id: "alloc-1" });
  });

  it("rejects duplicate student IDs", async () => {
    await expect(
      service.recordBulkAttendance(
        "2026-07-28",
        "class-uuid",
        [
          { studentId: "s1", status: "PRESENT" },
          { studentId: "s1", status: "ABSENT" },
        ],
        faculty,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("Duplicate"),
    });
    expect(repo.upsertBulkAttendance).not.toHaveBeenCalled();
  });

  it("rejects faculty without timetable allocation for the class", async () => {
    (prisma.subjectAllocation.findFirst as any).mockResolvedValue(null);

    await expect(
      service.recordBulkAttendance(
        "2026-07-28",
        "class-uuid",
        [{ studentId: "s1", status: "PRESENT" }],
        faculty,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(repo.upsertBulkAttendance).not.toHaveBeenCalled();
  });

  it("runs upserts and rate updates inside a transaction", async () => {
    const result = await service.recordBulkAttendance(
      "2026-07-28",
      "class-uuid",
      [
        { studentId: "s1", status: "PRESENT" },
        { studentId: "s2", status: "LATE" },
      ],
      faculty,
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(repo.upsertBulkAttendance).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ studentId: "s1", status: "PRESENT" }),
        expect.objectContaining({ studentId: "s2", status: "LATE" }),
      ]),
      expect.anything(),
    );
    expect(repo.updateStudentAttendanceRate).toHaveBeenCalledTimes(2);
    expect(result.processedCount).toBe(2);
    expect(result.classId).toBe("class-uuid");
  });

  it("allows ADMIN without allocation check", async () => {
    (prisma.subjectAllocation.findFirst as any).mockResolvedValue(null);

    await service.recordBulkAttendance(
      "2026-07-28",
      "class-uuid",
      [{ studentId: "s1", status: "PRESENT" }],
      {
        sub: "a",
        email: "a@school.com",
        role: "ADMIN",
        entityType: "STAFF",
        entityInternalId: "staff-1",
      },
    );

    expect(prisma.subjectAllocation.findFirst).not.toHaveBeenCalled();
    expect(repo.upsertBulkAttendance).toHaveBeenCalled();
  });

  it("rejects students not in the class", async () => {
    repo.findMismatchedStudents.mockResolvedValue(["s-bad"]);

    await expect(
      service.recordBulkAttendance(
        "2026-07-28",
        "class-uuid",
        [{ studentId: "s-bad", status: "PRESENT" }],
        {
          sub: "a",
          email: "a@school.com",
          role: "ADMIN",
          entityType: "STAFF",
          entityInternalId: "staff-1",
        },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
