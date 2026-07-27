/* eslint-disable @typescript-eslint/no-explicit-any -- repository test doubles are partial */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/middleware/error.handler";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
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
    };

    service = new AttendanceService(repo);
    vi.clearAllMocks();
    (prisma.$transaction as any).mockImplementation(async (callback: any) => callback({}));
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
