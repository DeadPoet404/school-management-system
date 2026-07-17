import { z } from "zod";

export const teacherUpdateSchema = z.object({
  teacherName: z.string().min(1, "Teacher name cannot be empty").optional(),
  department: z.string().min(1, "Department cannot be empty").optional(),
  subject: z.string().min(1, "Subject cannot be empty").optional(),
  employmentType: z.string().optional(),
  demographics: z.object({
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    residentialAddress: z.string().optional(),
    phone: z.string().optional(),
    bloodType: z.string().nullable().optional(),
    religion: z.string().nullable().optional(),
    formerSchool: z.string().nullable().optional(),
  }).optional(),
  compliance: z.object({
    nationalId: z.string().nullable().optional(),
    ssnitNumber: z.string().nullable().optional(),
    emergencyName: z.string().nullable().optional(),
    emergencyPhone: z.string().nullable().optional(),
  }).optional(),
  payroll: z.object({
    clearanceTier: z.string().optional(),
    baseSalary: z.union([z.string(), z.number()]).optional(),
    deductions: z.union([z.string(), z.number()]).optional(),
    netPay: z.union([z.string(), z.number()]).optional(),
    paymentRoute: z.string().optional(),
    bankName: z.string().nullable().optional(),
    bankAccount: z.string().nullable().optional(),
  }).optional(),
});
