import { z } from "zod";

const serviceDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "serviceDate must be YYYY-MM-DD.");

const dateTime = z
  .string()
  .min(1, "A timestamp is required.")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Timestamp must be a valid ISO date.");

export const busCreateSchema = z.object({
  code: z.string().trim().min(1).max(32),
  registrationNumber: z.string().trim().max(64).nullable().optional(),
  capacity: z.coerce.number().int().min(1).max(200).nullable().optional(),
});

export const assignmentCreateSchema = z.object({
  studentId: z.string().trim().min(1),
  busId: z.string().trim().min(1),
  effectiveFrom: dateTime,
  effectiveTo: dateTime.nullable().optional(),
});

export const cardIssueSchema = z.object({
  studentId: z.string().trim().min(1),
  replaceExisting: z.boolean().default(true),
});

export const tripOpenSchema = z.object({
  busId: z.string().trim().min(1),
  serviceDate,
  direction: z.enum(["TO_SCHOOL", "FROM_SCHOOL"]),
  operatorId: z.string().trim().min(1).nullable().optional(),
});

export const tripStatusSchema = z.object({
  status: z.enum(["CLOSED", "CANCELLED", "OPEN"]),
});

const syncEventSchema = z.object({
  clientEventId: z.string().trim().min(8).max(128),
  qrToken: z.string().trim().min(1).max(1024).nullable().optional(),
  studentId: z.string().trim().min(1).nullable().optional(),
  source: z.enum(["QR", "MANUAL"]),
  deviceCapturedAt: dateTime,
  rosterVersion: z.string().trim().max(128).nullable().optional(),
  manualReason: z.string().trim().max(500).nullable().optional(),
});

export const syncBatchSchema = z.object({
  batchId: z.string().trim().min(8).max(128),
  deviceCode: z.string().trim().min(1).max(64),
  tripId: z.string().trim().min(1),
  events: z.array(syncEventSchema).min(1).max(500),
});

export const rosterQuerySchema = z.object({
  busId: z.string().trim().min(1),
  serviceDate,
  direction: z.enum(["TO_SCHOOL", "FROM_SCHOOL"]),
  knownVersion: z.string().trim().max(128).optional(),
});

export type BusCreateInput = z.infer<typeof busCreateSchema>;
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type CardIssueInput = z.infer<typeof cardIssueSchema>;
export type TripOpenInput = z.infer<typeof tripOpenSchema>;
export type SyncBatchInput = z.infer<typeof syncBatchSchema>;
export type SyncEventInput = z.infer<typeof syncEventSchema>;
