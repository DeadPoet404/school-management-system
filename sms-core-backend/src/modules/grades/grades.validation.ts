import { z } from "zod";

export const submitMarkSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  subjectId: z.string().min(1, "Subject ID is required"),
  classId: z.string().min(1, "Class ID is required"),
  termId: z.string().min(1, "Term ID is required"),
  continuousAssessment: z.coerce.number({ message: "Continuous assessment must be a number" }).min(0, "Class score cannot be negative").max(30, "Class score cannot exceed 30"),
  examination: z.coerce.number({ message: "Examination score must be a number" }).min(0, "Exam score cannot be negative").max(70, "Exam score cannot exceed 70"),
  // P2-9: Credit hours for weighted GPA calculation.
  // Defaults to 3 if not provided (common secondary school default).
  creditHours: z.coerce.number({ message: "Credit hours must be a number" }).int().min(1, "Credit hours must be at least 1").max(6, "Credit hours cannot exceed 6").default(3),
});
