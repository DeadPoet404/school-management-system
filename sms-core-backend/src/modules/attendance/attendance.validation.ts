import { z } from "zod";

// P2-7: Date must be a valid parseable date string, not arbitrary text like "yesterday".
// Zod's .date() only works with Date objects, so we use string + refine to validate
// that new Date(input) produces a real date (not NaN).
const validDateString = z.string().min(1, "Date is required").refine(
  (val) => !isNaN(new Date(val).getTime()),
  { message: "Date must be a valid date string (e.g. 2026-07-18)" }
);

export const submitSectionAttendanceSchema = z.object({
  date: validDateString,
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
