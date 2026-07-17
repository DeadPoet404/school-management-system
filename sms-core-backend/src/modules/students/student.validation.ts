import { z } from "zod";

export const studentUpdateSchema = z.object({
  studentName: z.string().min(1, "Student name cannot be empty").optional(),
  demographics: z.object({
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    residentialAddress: z.string().optional(),
    medicalNotes: z.string().nullable().optional(),
    bloodType: z.string().nullable().optional(),
    religion: z.string().nullable().optional(),
    formerSchool: z.string().nullable().optional(),
    nationalId: z.string().nullable().optional(),
  }).optional(),
  placement: z.object({
    classId: z.string().min(1, "Class ID cannot be empty").optional(),
    academicTrack: z.string().optional(),
    boardingStatus: z.string().optional(),
  }).optional(),
  compliance: z.object({
    nationalId: z.string().nullable().optional(),
    emergencyName: z.string().nullable().optional(),
    emergencyPhone: z.string().nullable().optional(),
    emergencyRelation: z.string().nullable().optional(),
  }).optional(),
});
