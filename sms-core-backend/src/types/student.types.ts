import { z } from 'zod';

export const createStudentSchema = z.object({
  account: z.object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Invalid email format provided"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    enrollmentDate: z.string().min(1, "Enrollment date is required"),
  }),
  demographics: z.object({
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    gender: z.string().min(1, "Gender is required"),
    residentialAddress: z.string().min(1, "Residential address is required"),
    medicalNotes: z.string().nullable().optional(),
    bloodType: z.string().nullable().optional(),
    religion: z.string().nullable().optional(),
    formerSchool: z.string().nullable().optional(),
  }),
  placement: z.object({
    classId: z.string().min(1, "Class ID is required"),
    academicTrack: z.string().min(1, "Academic track is required"),
    boardingStatus: z.string().min(1, "Boarding status is required"),
  }),
  guardian: z.object({
    name: z.string().min(1, "Guardian name is required"),
    relationship: z.string().min(1, "Relationship is required"),
    phone: z.string().min(1, "Guardian phone is required"),
    email: z.string().nullable().optional(),
  }),
  billing: z.object({
    feeTierId: z.string().min(1, "Fee tier is required"),
    initialDeposit: z.number(),
  }),
  compliance: z.object({
    nationalId: z.string().nullable().optional(),
    emergencyContact: z.object({
      name: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      relationship: z.string().nullable().optional(),
    }).nullable().optional(),
  }).optional(),
}).strict();