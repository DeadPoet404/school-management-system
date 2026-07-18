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
  // Backported from staff.validation.ts: z.union([z.string(), z.number()])
  // accepted non-numeric strings like "abc". z.coerce.number() rejects them
  // at the validation boundary with a clear error message.
  payroll: z.object({
    clearanceTier: z.string().optional(),
    baseSalary: z.coerce.number({ message: "Base salary must be a valid number" }).min(0, "Base salary cannot be negative").optional(),
    deductions: z.coerce.number({ message: "Deductions must be a valid number" }).min(0, "Deductions cannot be negative").optional(),
    netPay: z.coerce.number({ message: "Net pay must be a valid number" }).min(0, "Net pay cannot be negative").optional(),
    paymentRoute: z.string().optional(),
    bankName: z.string().nullable().optional(),
    bankAccount: z.string().nullable().optional(),
  }).optional(),
});
