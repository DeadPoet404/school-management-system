import { z } from "zod";

export const submitMarkSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  subjectId: z.string().min(1, "Subject ID is required"),
  classId: z.string().min(1, "Class ID is required"),
  termId: z.string().min(1, "Term ID is required"),
  continuousAssessment: z.coerce.number({ message: "Continuous assessment must be a number" }),
  examination: z.coerce.number({ message: "Examination score must be a number" }),
});
