import { z } from 'zod';

export const createTeacherSchema = z.object({
  account: z.object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Invalid email format provided"),
  }),
  placement: z.object({
    departmentId: z.string().optional(),
    jobTitle: z.string().optional(),
    employmentType: z.string().optional(),
  }).optional(),
}).strict();