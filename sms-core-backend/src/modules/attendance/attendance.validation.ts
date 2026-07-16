import { z } from "zod";

export const submitSectionAttendanceSchema = z.object({
  date: z.string().min(1, "Date is required"),
  classId: z.string().min(1, "Class ID is required"),
  records: z.array(
    z.object({
      studentId: z.string().min(1, "Student ID is required"),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"], {
        message: "Status must be PRESENT, ABSENT, LATE, or EXCUSED",
      }),
    })
  ).min(1, "At least one attendance record is required"),
});
