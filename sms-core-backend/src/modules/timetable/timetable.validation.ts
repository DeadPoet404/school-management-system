import { z } from "zod";

export const saveMatrixSchema = z.object({
  data: z.record(z.string(), z.object({
    periodsCount: z.number().int().min(0),
    periods: z.array(z.object({
      startTime: z.string().min(1, "Start time is required"),
      endTime: z.string().min(1, "End time is required"),
    })),
    breaks: z.array(z.object({
      id: z.string().optional(),
      name: z.string().min(1, "Break name is required"),
      startTime: z.string().min(1, "Start time is required"),
      endTime: z.string().min(1, "End time is required"),
    })),
    subjects: z.array(z.object({
      id: z.string().optional(),
      subjectName: z.string().min(1, "Subject name is required"),
      teacherId: z.string().min(1, "Teacher ID is required"),
    })),
  })),
});
