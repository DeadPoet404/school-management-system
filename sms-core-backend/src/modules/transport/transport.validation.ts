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

export const routeCreateSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(2000).nullable().optional(),
});

// isActive is the retirement switch. Routes are never hard-deleted while stops
// or assignments reference them (the FK is RESTRICT), so deactivating is how a
// route leaves service while its history stays reconcilable.
export const routeUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");

const coordinate = (limit: number) =>
  z.coerce.number().min(-limit).max(limit).nullable().optional();

export const stopCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  // Omitted => appended after the current highest sequence on the route.
  sequence: z.coerce.number().int().min(1).max(999).nullable().optional(),
  latitude: coordinate(90),
  longitude: coordinate(180),
});

export const stopUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    sequence: z.coerce.number().int().min(1).max(999).optional(),
    latitude: coordinate(90),
    longitude: coordinate(180),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");

export const assignmentCreateSchema = z.object({
  studentId: z.string().trim().min(1),
  busId: z.string().trim().min(1),
  routeId: z.string().trim().min(1).nullable().optional(),
  stopId: z.string().trim().min(1).nullable().optional(),
  effectiveFrom: dateTime,
  effectiveTo: dateTime.nullable().optional(),
});

export const cardIssueSchema = z.object({
  studentId: z.string().trim().min(1),
  replaceExisting: z.boolean().default(true),
});

export const tripOpenSchema = z.object({
  busId: z.string().trim().min(1),
  routeId: z.string().trim().min(1).nullable().optional(),
  serviceDate,
  direction: z.enum(["TO_SCHOOL", "FROM_SCHOOL"]),
  operatorId: z.string().trim().min(1).nullable().optional(),
  // Re-opening a CLOSED or CANCELLED trip is a deliberate act, not a side
  // effect of a retried POST. Without this flag the upsert silently reset
  // status to OPEN and wiped endedAt, which destroys the reconciliation
  // boundary for a completed run.
  reopen: z.boolean().default(false),
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

export const busDriverAssignSchema = z.object({
  driverStaffId: z.string().trim().min(1).nullable(),
});

export type BusCreateInput = z.infer<typeof busCreateSchema>;
export type RouteCreateInput = z.infer<typeof routeCreateSchema>;
export type RouteUpdateInput = z.infer<typeof routeUpdateSchema>;
export type StopCreateInput = z.infer<typeof stopCreateSchema>;
export type StopUpdateInput = z.infer<typeof stopUpdateSchema>;
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type CardIssueInput = z.infer<typeof cardIssueSchema>;
export type TripOpenInput = z.infer<typeof tripOpenSchema>;
export type SyncBatchInput = z.infer<typeof syncBatchSchema>;
export type SyncEventInput = z.infer<typeof syncEventSchema>;
export type BusDriverAssignInput = z.infer<typeof busDriverAssignSchema>;
