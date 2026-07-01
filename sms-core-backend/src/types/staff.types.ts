import { z } from 'zod';

export const createStaffSchema = z.object({
  account: z.object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Invalid email format provided"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    employmentDate: z.string().min(1, "Employment date is required"),
    role: z.string().optional(),
  }),
  demographics: z.object({
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    gender: z.string().min(1, "Gender is required"),
    residentialAddress: z.string().min(1, "Residential address is required"),
    phone: z.string().min(1, "Phone number is required"),
    bloodType: z.string().nullable().optional(),
    religion: z.string().nullable().optional(),
    formerSchool: z.string().nullable().optional(),
  }),
  placement: z.object({
    departmentId: z.string().min(1, "Department ID is required"),
    jobTitle: z.string().min(1, "Job title is required"),
    employmentType: z.string().min(1, "Employment type is required"),
    shiftSchedule: z.string().min(1, "Shift schedule is required"),
  }),
  compliance: z.object({
    nationalId: z.string().nullable().optional(),
    ssnitNumber: z.string().nullable().optional(),
    emergencyContact: z.object({
      name: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
    }).nullable().optional(),
  }).optional(),
  payroll: z.object({
    clearanceTier: z.string().min(1, "Clearance tier is required"),
    baseSalary: z.union([z.string(), z.number()]),
    bankName: z.string().nullable().optional(),
    bankAccount: z.string().nullable().optional(),
  }),
}).strict(); // Rejects any unexpected keys from the frontend