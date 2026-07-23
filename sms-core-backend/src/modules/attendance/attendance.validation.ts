import { z } from "zod";

/**
 * POST /api/attendance/section
 * Bulk upsert attendance for a class on a specific date.
 */
export const submitSectionAttendanceSchema = z.object({
  date: z.string().min(1, "Attendance date is required."),
  classId: z.string().min(1, "Class ID is required."),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1, "Student ID is required."),
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
        remarks: z.string().nullable().optional(),
      })
    )
    .min(1, "At least one attendance record is required."),
});

/**
 * GET /api/attendance/class/:classId
 * Query params: date (YYYY-MM-DD), optional.
 */
export const classAttendanceQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
});

/**
 * GET /api/attendance/student/:studentId
 * Query params: from, to (optional date range), limit.
 */
export const studentAttendanceQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD").optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
