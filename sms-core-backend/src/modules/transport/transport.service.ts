import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { PrismaClient, TransportAssignmentStatus, TransportBoardingSource, TransportCardStatus, TransportTripStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/middleware/error.handler";
import type {
  AssignmentCreateInput,
  BusCreateInput,
  CardIssueInput,
  SyncBatchInput,
  SyncEventInput,
  TripOpenInput,
} from "./transport.validation";

const TOKEN_PREFIX = "tr1";
const STALE_ROSTER_HOURS = 24;

type DbClient = PrismaClient;

export type TransportSyncResult = {
  clientEventId: string;
  status: "ACCEPTED" | "DUPLICATE" | "REJECTED";
  code: string;
  studentId?: string;
  assignmentStatus?: TransportAssignmentStatus;
  warnings: string[];
};

export interface TransportReportQuery {
  from: Date;
  to: Date;
  busId?: string;
  direction?: "TO_SCHOOL" | "FROM_SCHOOL";
}

export interface QrTokenPayload {
  cardId: string;
  version: number;
}

function tokenSecret(): string {
  const secret = process.env.TRANSPORT_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError(500, "Transport token signing is not configured.");
  }
  return secret;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function signature(input: string): string {
  return createHmac("sha256", tokenSecret()).update(input).digest("base64url");
}

/**
 * QR values are deliberately opaque: only a random card id and token version
 * are signed. No student name, student number, phone number, or other PII is
 * embedded in a scanner token.
 */
export function signTransportQrToken(payload: QrTokenPayload): string {
  const encodedPayload = encode(JSON.stringify(payload));
  const unsigned = `${TOKEN_PREFIX}.${encodedPayload}`;
  return `${unsigned}.${signature(unsigned)}`;
}

export function verifyTransportQrToken(token: string): QrTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;

  const unsigned = `${parts[0]}.${parts[1]}`;
  const expected = signature(unsigned);
  const actual = parts[2] ?? "";
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  if (expectedBytes.length !== actualBytes.length || !timingSafeEqual(expectedBytes, actualBytes)) {
    return null;
  }

  const decoded = decode(parts[1] ?? "");
  if (!decoded) return null;

  try {
    const parsed = JSON.parse(decoded) as Partial<QrTokenPayload>;
    if (typeof parsed.cardId !== "string" || !parsed.cardId || typeof parsed.version !== "number" || !Number.isInteger(parsed.version)) {
      return null;
    }
    return { cardId: parsed.cardId, version: parsed.version };
  } catch {
    return null;
  }
}

function startOfServiceDate(value: string): Date {
  // Ghana/Abidjan is UTC. Keeping the contract at a date boundary avoids
  // device timezone drift between the Android client, web simulator, and API.
  return new Date(`${value}T00:00:00.000Z`);
}

function nextServiceDate(value: Date): Date {
  return new Date(value.getTime() + 24 * 60 * 60 * 1000);
}

function parseDateTime(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new AppError(400, `Invalid timestamp: ${value}`);
  return parsed;
}

function rosterHash(rows: Array<Record<string, unknown>>): string {
  const canonical = JSON.stringify(rows);
  return createHmac("sha256", tokenSecret()).update(canonical).digest("hex").slice(0, 32);
}

export class TransportService {
  constructor(private readonly db: DbClient = prisma) {}

  async listBuses() {
    return this.db.transportBus.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      include: {
        _count: {
          select: { assignments: true, trips: true, devices: true },
        },
      },
    });
  }

  async createBus(input: BusCreateInput) {
    return this.db.transportBus.create({
      data: {
        code: input.code,
        registrationNumber: input.registrationNumber ?? null,
        capacity: input.capacity ?? null,
      },
    });
  }

  async listStudentCandidates(search?: string) {
    const term = search?.trim();
    return this.db.student.findMany({
      where: {
        status: "ACTIVE",
        ...(term
          ? {
              OR: [
                { studentName: { contains: term, mode: "insensitive" } },
                { studentId: { contains: term, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { studentName: "asc" },
      take: 200,
      select: {
        id: true,
        studentId: true,
        studentName: true,
        placement: { select: { classId: true, class: { select: { name: true } } } },
        transportCards: {
          where: { status: TransportCardStatus.ACTIVE },
          orderBy: { issuedAt: "desc" },
          take: 1,
          select: { id: true, qrToken: true, issuedAt: true },
        },
      },
    });
  }

  async createAssignment(input: AssignmentCreateInput) {
    const effectiveFrom = parseDateTime(input.effectiveFrom);
    const effectiveTo = input.effectiveTo ? parseDateTime(input.effectiveTo) : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new AppError(400, "effectiveTo must be on or after effectiveFrom.");
    }

    const [student, bus] = await Promise.all([
      this.db.student.findUnique({ where: { id: input.studentId }, select: { id: true, studentName: true } }),
      this.db.transportBus.findFirst({ where: { id: input.busId, isActive: true }, select: { id: true, code: true } }),
    ]);
    if (!student) throw new AppError(404, "Student not found.");
    if (!bus) throw new AppError(404, "Active transport bus not found.");

    return this.db.$transaction(async (tx) => {
      // Close an open previous assignment at the boundary of the new one.
      // This preserves the historical row while making the effective roster
      // deterministic for offline devices.
      await tx.transportAssignment.updateMany({
        where: {
          studentId: student.id,
          effectiveFrom: { lt: effectiveFrom },
          effectiveTo: null,
        },
        data: { effectiveTo: new Date(effectiveFrom.getTime() - 1) },
      });

      return tx.transportAssignment.create({
        data: {
          studentId: student.id,
          busId: bus.id,
          effectiveFrom,
          effectiveTo,
        },
        include: { bus: { select: { id: true, code: true } }, student: { select: { id: true, studentId: true, studentName: true } } },
      });
    });
  }

  async issueCard(input: CardIssueInput) {
    const student = await this.db.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, studentId: true, studentName: true },
    });
    if (!student) throw new AppError(404, "Student not found.");

    return this.db.$transaction(async (tx) => {
      if (input.replaceExisting) {
        await tx.transportCard.updateMany({
          where: { studentId: student.id, status: TransportCardStatus.ACTIVE },
          data: { status: TransportCardStatus.REVOKED, revokedAt: new Date() },
        });
      }

      const cardId = randomUUID();
      const qrToken = signTransportQrToken({ cardId, version: 1 });
      return tx.transportCard.create({
        data: {
          id: cardId,
          studentId: student.id,
          qrToken,
          tokenVersion: 1,
        },
        select: {
          id: true,
          qrToken: true,
          tokenVersion: true,
          status: true,
          issuedAt: true,
          student: { select: { id: true, studentId: true, studentName: true } },
        },
      });
    });
  }

  async openTrip(input: TripOpenInput) {
    const serviceDate = startOfServiceDate(input.serviceDate);
    const bus = await this.db.transportBus.findFirst({
      where: { id: input.busId, isActive: true },
      select: { id: true, code: true, capacity: true },
    });
    if (!bus) throw new AppError(404, "Active transport bus not found.");

    const uniqueWhere = {
      busId_serviceDate_direction: {
        busId: bus.id,
        serviceDate,
        direction: input.direction,
      },
    };
    const include = { bus: { select: { id: true, code: true, capacity: true } } } as const;

    // Guard the reopen path BEFORE the upsert. The upsert's update branch
    // resets status to OPEN and clears endedAt, so an unguarded call against a
    // completed run silently destroys its reconciliation boundary — a
    // double-tap, a device retry or a stale control-room tab is enough.
    const existing = await this.db.transportTrip.findUnique({
      where: uniqueWhere,
      select: { id: true, status: true, endedAt: true },
    });

    if (existing && existing.status !== TransportTripStatus.OPEN && !input.reopen) {
      throw new AppError(
        409,
        `Trip for bus ${bus.code} on ${input.serviceDate} (${input.direction}) is already ${existing.status}. ` +
          `Pass reopen: true to reopen it deliberately; this clears endedAt.`
      );
    }

    // An already-OPEN trip is idempotent: return it untouched so offline
    // devices and retried control-room calls never mutate a live run.
    if (existing && existing.status === TransportTripStatus.OPEN) {
      return this.db.transportTrip.findUniqueOrThrow({ where: uniqueWhere, include });
    }

    const trip = await this.db.transportTrip.upsert({
      where: uniqueWhere,
      update: {
        status: TransportTripStatus.OPEN,
        operatorId: input.operatorId ?? undefined,
        endedAt: null,
      },
      create: {
        busId: bus.id,
        serviceDate,
        direction: input.direction,
        operatorId: input.operatorId ?? null,
      },
      include,
    });
    return trip;
  }

  async listTrips(serviceDate?: string) {
    const where = serviceDate ? { serviceDate: startOfServiceDate(serviceDate) } : undefined;
    return this.db.transportTrip.findMany({
      where,
      orderBy: [{ serviceDate: "desc" }, { direction: "asc" }],
      take: 100,
      include: {
        bus: { select: { id: true, code: true, capacity: true } },
        _count: { select: { events: true } },
      },
    });
  }

  async updateTripStatus(tripId: string, status: "OPEN" | "CLOSED" | "CANCELLED") {
    const existing = await this.db.transportTrip.findUnique({ where: { id: tripId }, select: { id: true } });
    if (!existing) throw new AppError(404, "Trip not found.");
    return this.db.transportTrip.update({
      where: { id: tripId },
      data: {
        status,
        endedAt: status === "OPEN" ? null : new Date(),
      },
      include: { bus: { select: { id: true, code: true, capacity: true } } },
    });
  }

  private async loadRosterEntries(busId: string, serviceDate: Date) {
    const nextDate = nextServiceDate(serviceDate);
    const assignments = await this.db.transportAssignment.findMany({
      where: {
        effectiveFrom: { lt: nextDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: serviceDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
      include: {
        bus: { select: { id: true, code: true } },
        student: {
          select: {
            id: true,
            studentId: true,
            studentName: true,
            status: true,
            placement: { select: { class: { select: { name: true } } } },
            transportCards: {
              where: { status: TransportCardStatus.ACTIVE },
              orderBy: { issuedAt: "desc" },
              take: 1,
              select: { id: true, qrToken: true, issuedAt: true, tokenVersion: true },
            },
          },
        },
      },
    });

    const latestByStudent = new Map<string, (typeof assignments)[number]>();
    for (const assignment of assignments) {
      if (!latestByStudent.has(assignment.studentId)) latestByStudent.set(assignment.studentId, assignment);
    }

    return Array.from(latestByStudent.values())
      .filter((assignment) => assignment.busId === busId)
      .filter((assignment) => assignment.student.status === "ACTIVE")
      .sort((a, b) => a.student.studentName.localeCompare(b.student.studentName));
  }

  async getRoster(input: { busId: string; serviceDate: string; direction: "TO_SCHOOL" | "FROM_SCHOOL"; knownVersion?: string }) {
    const date = startOfServiceDate(input.serviceDate);
    const [bus, entries] = await Promise.all([
      this.db.transportBus.findFirst({ where: { id: input.busId, isActive: true }, select: { id: true, code: true, capacity: true } }),
      this.loadRosterEntries(input.busId, date),
    ]);
    if (!bus) throw new AppError(404, "Active transport bus not found.");

    const versionRows = entries.map((entry) => ({
      assignmentId: entry.id,
      studentId: entry.student.id,
      cardId: entry.student.transportCards[0]?.id ?? null,
      cardVersion: entry.student.transportCards[0]?.tokenVersion ?? null,
      busId: entry.busId,
      effectiveFrom: entry.effectiveFrom.toISOString(),
      effectiveTo: entry.effectiveTo?.toISOString() ?? null,
    }));
    const rosterVersion = rosterHash(versionRows);
    const generatedAt = new Date();
    const staleByVersion = Boolean(input.knownVersion && input.knownVersion !== rosterVersion);

    return {
      bus,
      serviceDate: input.serviceDate,
      direction: input.direction,
      rosterVersion,
      generatedAt,
      staleAfterHours: STALE_ROSTER_HOURS,
      isVersionStale: staleByVersion,
      warnings: staleByVersion ? ["ROSTER_VERSION_CHANGED"] : [],
      roster: entries.map((entry) => ({
        assignmentId: entry.id,
        student: {
          id: entry.student.id,
          studentId: entry.student.studentId,
          studentName: entry.student.studentName,
          className: entry.student.placement?.class?.name ?? null,
        },
        card: entry.student.transportCards[0]
          ? {
              id: entry.student.transportCards[0].id,
              qrToken: entry.student.transportCards[0].qrToken,
              tokenVersion: entry.student.transportCards[0].tokenVersion,
              issuedAt: entry.student.transportCards[0].issuedAt,
            }
          : null,
        effectiveFrom: entry.effectiveFrom,
        effectiveTo: entry.effectiveTo,
      })),
    };
  }

  private async resolveStudent(event: SyncEventInput) {
    if (event.source === TransportBoardingSource.QR) {
      if (!event.qrToken) return { error: "INVALID_TOKEN" as const };
      const payload = verifyTransportQrToken(event.qrToken);
      if (!payload) return { error: "INVALID_TOKEN" as const };

      const card = await this.db.transportCard.findUnique({
        where: { qrToken: event.qrToken },
        select: { id: true, studentId: true, tokenVersion: true, status: true },
      });
      if (!card || card.id !== payload.cardId) return { error: "UNKNOWN_TOKEN" as const };
      if (card.status !== TransportCardStatus.ACTIVE || card.tokenVersion !== payload.version) {
        return { error: "REVOKED_TOKEN" as const };
      }
      if (event.studentId && event.studentId !== card.studentId) return { error: "TOKEN_STUDENT_MISMATCH" as const };
      return { studentId: card.studentId, cardId: card.id };
    }

    if (!event.studentId) return { error: "STUDENT_REQUIRED" as const };
    const student = await this.db.student.findFirst({
      where: { OR: [{ id: event.studentId }, { studentId: event.studentId }] },
      select: { id: true },
    });
    if (!student) return { error: "STUDENT_NOT_FOUND" as const };
    if (!event.manualReason?.trim()) return { error: "MANUAL_REASON_REQUIRED" as const };
    return { studentId: student.id, cardId: null };
  }

  private async currentAssignments(studentIds: string[], serviceDate: Date) {
    if (studentIds.length === 0) return new Map<string, { busId: string }>();
    const assignments = await this.db.transportAssignment.findMany({
      where: {
        studentId: { in: studentIds },
        effectiveFrom: { lt: nextServiceDate(serviceDate) },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: serviceDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
      select: { studentId: true, busId: true },
    });
    const result = new Map<string, { busId: string }>();
    for (const assignment of assignments) {
      if (!result.has(assignment.studentId)) result.set(assignment.studentId, { busId: assignment.busId });
    }
    return result;
  }

  /**
   * Accepts a device's locally captured events in one request. No scan calls
   * this method individually: a native device and the browser simulator both
   * send durable batches, and clientEventId makes retries safe.
   */
  async syncBatch(input: SyncBatchInput, operatorId?: string) {
    const trip = await this.db.transportTrip.findUnique({
      where: { id: input.tripId },
      select: { id: true, busId: true, serviceDate: true, direction: true, status: true },
    });
    if (!trip) throw new AppError(404, "Trip not found.");

    const existingEvents = await this.db.transportBoardingEvent.findMany({
      where: { clientEventId: { in: input.events.map((event) => event.clientEventId) } },
      select: { clientEventId: true, studentId: true, assignmentStatus: true },
    });
    const existingByClientId = new Map(existingEvents.map((event) => [event.clientEventId, event]));
    const results: TransportSyncResult[] = [];
    const seenClientIds = new Set<string>();
    const candidateEvents: Array<{
      input: SyncEventInput;
      studentId: string;
      cardId: string | null;
      assignmentStatus: TransportAssignmentStatus;
      rosterWarnings: string[];
      deviceCapturedAt: Date;
    }> = [];
    const candidateStudentIds: string[] = [];

    for (const event of input.events) {
      const existing = existingByClientId.get(event.clientEventId);
      if (existing || seenClientIds.has(event.clientEventId)) {
        results.push({
          clientEventId: event.clientEventId,
          status: "DUPLICATE",
          code: existing ? "CLIENT_EVENT_ALREADY_SYNCED" : "DUPLICATE_IN_BATCH",
          studentId: existing?.studentId,
          assignmentStatus: existing?.assignmentStatus,
          warnings: [],
        });
        seenClientIds.add(event.clientEventId);
        continue;
      }
      seenClientIds.add(event.clientEventId);

      if (trip.status !== TransportTripStatus.OPEN) {
        results.push({ clientEventId: event.clientEventId, status: "REJECTED", code: "TRIP_NOT_OPEN", warnings: [] });
        continue;
      }

      const resolved = await this.resolveStudent(event);
      if ("error" in resolved) {
        results.push({ clientEventId: event.clientEventId, status: "REJECTED", code: resolved.error ?? "INVALID_EVENT", warnings: [] });
        continue;
      }

      candidateStudentIds.push(resolved.studentId);
      candidateEvents.push({
        input: event,
        studentId: resolved.studentId,
        cardId: resolved.cardId,
        assignmentStatus: TransportAssignmentStatus.UNASSIGNED,
        rosterWarnings: [],
        deviceCapturedAt: parseDateTime(event.deviceCapturedAt),
      });
    }

    const assignmentByStudent = candidateStudentIds.length > 0
      ? await this.currentAssignments(candidateStudentIds, trip.serviceDate)
      : new Map<string, { busId: string }>();
    const roster = candidateStudentIds.length > 0
      ? await this.getRoster({
          busId: trip.busId,
          serviceDate: trip.serviceDate.toISOString().slice(0, 10),
          direction: trip.direction,
        })
      : null;
    const existingBoardings = candidateStudentIds.length > 0
      ? await this.db.transportBoardingEvent.findMany({
          where: { tripId: trip.id, studentId: { in: candidateStudentIds } },
          select: { studentId: true },
        })
      : [];
    const boardedStudents = new Set(existingBoardings.map((event) => event.studentId));

    const rowsToCreate: Array<Record<string, unknown>> = [];
    const acceptedByClientId = new Map<string, TransportSyncResult>();
    for (const candidate of candidateEvents) {
      const previousInBatch = candidateEvents.findIndex((other) => other.input.clientEventId === candidate.input.clientEventId) !== candidateEvents.indexOf(candidate);
      if (previousInBatch) continue;

      if (boardedStudents.has(candidate.studentId)) {
        results.push({
          clientEventId: candidate.input.clientEventId,
          status: "DUPLICATE",
          code: "STUDENT_ALREADY_BOARDED",
          studentId: candidate.studentId,
          warnings: [],
        });
        continue;
      }

      const assignment = assignmentByStudent.get(candidate.studentId);
      const assignmentStatus = assignment?.busId === trip.busId
        ? TransportAssignmentStatus.ASSIGNED
        : TransportAssignmentStatus.UNASSIGNED;
      const warnings: string[] = [];
      if (candidate.input.rosterVersion && roster && candidate.input.rosterVersion !== roster.rosterVersion) warnings.push("ROSTER_STALE");
      if (assignmentStatus === TransportAssignmentStatus.UNASSIGNED) {
        warnings.push(assignment ? "WRONG_BUS" : "NO_ACTIVE_ASSIGNMENT");
      }

      candidate.assignmentStatus = assignmentStatus;
      candidate.rosterWarnings = warnings;
      rowsToCreate.push({
        id: randomUUID(),
        clientEventId: candidate.input.clientEventId,
        tripId: trip.id,
        studentId: candidate.studentId,
        cardId: candidate.cardId,
        deviceId: null,
        operatorId: operatorId ?? null,
        deviceCapturedAt: candidate.deviceCapturedAt,
        source: candidate.input.source,
        assignmentStatus,
        rosterVersion: candidate.input.rosterVersion ?? null,
        syncBatchId: input.batchId,
        manualReason: candidate.input.manualReason ?? null,
      });
      acceptedByClientId.set(candidate.input.clientEventId, {
        clientEventId: candidate.input.clientEventId,
        status: "ACCEPTED",
        code: "BOARDED",
        studentId: candidate.studentId,
        assignmentStatus,
        warnings,
      });
      boardedStudents.add(candidate.studentId);
    }

    const device = await this.db.transportDevice.findUnique({
      where: { deviceCode: input.deviceCode },
      select: { id: true, busId: true, isActive: true },
    });
    if (device?.busId && device.busId !== trip.busId) {
      for (const row of rowsToCreate) {
        const result = acceptedByClientId.get(String(row.clientEventId));
        if (result) {
          result.status = "REJECTED";
          result.code = "DEVICE_BUS_MISMATCH";
          result.warnings = [];
          delete result.studentId;
          delete result.assignmentStatus;
        }
      }
      rowsToCreate.length = 0;
    }

    const persistedRows = rowsToCreate.map((row) => ({ ...row }));
    if (persistedRows.length > 0 || device) {
      await this.db.$transaction(async (tx) => {
        let deviceId = device?.id;
        if (!deviceId) {
          const created = await tx.transportDevice.create({
            data: { deviceCode: input.deviceCode, busId: trip.busId, lastSeenAt: new Date() },
            select: { id: true },
          });
          deviceId = created.id;
        } else {
          await tx.transportDevice.update({ where: { id: deviceId }, data: { lastSeenAt: new Date(), lastSyncAt: new Date() } });
        }

        if (persistedRows.length > 0) {
          await tx.transportBoardingEvent.createMany({
            data: persistedRows.map((row) => ({ ...row, deviceId })) as never,
            skipDuplicates: true,
          });
        }
        await tx.transportDevice.update({ where: { id: deviceId }, data: { lastSyncAt: new Date(), lastSeenAt: new Date() } });
      });
    }

    const acceptedIds = new Set(acceptedByClientId.keys());
    const appendedAcceptedIds = new Set<string>();
    for (const event of input.events) {
      if (acceptedIds.has(event.clientEventId) && !appendedAcceptedIds.has(event.clientEventId)) {
        results.push(acceptedByClientId.get(event.clientEventId)!);
        appendedAcceptedIds.add(event.clientEventId);
      }
    }

    const acceptedCount = results.filter((result) => result.status === "ACCEPTED").length;
    const duplicateCount = results.filter((result) => result.status === "DUPLICATE").length;
    const rejectedCount = results.filter((result) => result.status === "REJECTED").length;
    const warningCount = results.filter((result) => result.warnings.length > 0).length;

    return {
      batchId: input.batchId,
      tripId: trip.id,
      deviceCode: input.deviceCode,
      acceptedCount,
      duplicateCount,
      rejectedCount,
      warningCount,
      results,
    };
  }

  async getReport(query: TransportReportQuery) {
    const events = await this.db.transportBoardingEvent.findMany({
      where: {
        deviceCapturedAt: { gte: query.from, lt: query.to },
        ...(query.busId || query.direction
          ? {
              trip: {
                ...(query.busId ? { busId: query.busId } : {}),
                ...(query.direction ? { direction: query.direction } : {}),
              },
            }
          : {}),
      },
      orderBy: { deviceCapturedAt: "desc" },
      include: {
        student: { select: { id: true, studentId: true, studentName: true } },
        trip: { select: { id: true, serviceDate: true, direction: true, bus: { select: { id: true, code: true } } } },
      },
    });

    const byBus = new Map<string, number>();
    const byDirection = new Map<string, number>();
    const exceptions = events.filter((event) => event.assignmentStatus === TransportAssignmentStatus.UNASSIGNED);
    for (const event of events) {
      byBus.set(event.trip.bus.code, (byBus.get(event.trip.bus.code) ?? 0) + 1);
      byDirection.set(event.trip.direction, (byDirection.get(event.trip.direction) ?? 0) + 1);
    }

    return {
      from: query.from,
      to: query.to,
      summary: {
        totalBoardings: events.length,
        uniqueStudents: new Set(events.map((event) => event.studentId)).size,
        wrongBusOrUnassigned: exceptions.length,
        byBus: Object.fromEntries(byBus),
        byDirection: Object.fromEntries(byDirection),
      },
      exceptions: exceptions.map((event) => ({
        id: event.id,
        clientEventId: event.clientEventId,
        code: "WRONG_BUS_OR_NO_ASSIGNMENT",
        assignmentStatus: event.assignmentStatus,
        student: event.student,
        bus: event.trip.bus,
        direction: event.trip.direction,
        serviceDate: event.trip.serviceDate,
        deviceCapturedAt: event.deviceCapturedAt,
        rosterVersion: event.rosterVersion,
      })),
      events,
    };
  }
}

export function parseReportDate(value: unknown, fallback: Date): Date {
  if (typeof value !== "string" || !value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(400, `Invalid report date: ${value}`);
  return date;
}
