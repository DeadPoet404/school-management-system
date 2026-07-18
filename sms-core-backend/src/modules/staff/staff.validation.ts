import { z } from "zod";

export const staffUpdateSchema = z.object({
  staffName: z.string().min(1, "Staff name cannot be empty").optional(),
  demographics: z.object({
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    residentialAddress: z.string().optional(),
    phone: z.string().optional(),
    bloodType: z.string().nullable().optional(),
    religion: z.string().nullable().optional(),
    formerSchool: z.string().nullable().optional(),
  }).optional(),
  placement: z.object({
    departmentId: z.string().min(1, "Department ID cannot be empty").optional(),
    jobTitle: z.string().optional(),
    employmentType: z.string().optional(),
    shiftSchedule: z.string().optional(),
  }).optional(),
  compliance: z.object({
    nationalId: z.string().nullable().optional(),
    ssnitNumber: z.string().nullable().optional(),
    emergencyName: z.string().nullable().optional(),
    emergencyPhone: z.string().nullable().optional(),
  }).optional(),
  // P1-8: Payroll fields were z.union([z.string(), z.number()]) which let
  // non-numeric strings like "abc" pass validation. Now uses z.coerce.number()
  // which rejects non-numeric input at the validation boundary.
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
