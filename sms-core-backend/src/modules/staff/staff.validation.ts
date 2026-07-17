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
