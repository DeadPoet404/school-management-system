/* eslint-disable @typescript-eslint/no-explicit-any -- transport sync tests use a focused Prisma test double */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  signTransportQrToken,
  TransportService,
  verifyTransportQrToken,
} from "@/modules/transport/transport.service";
import type { SyncBatchInput } from "@/modules/transport/transport.validation";

process.env.TRANSPORT_TOKEN_SECRET = "transport-test-secret-that-is-long-enough";

function syncInput(overrides: Partial<SyncBatchInput> = {}): SyncBatchInput {
  const base: SyncBatchInput = {
    batchId: "batch-00000001",
    deviceCode: "browser-simulator-01",
    tripId: "trip-1",
    events: [
      {
        clientEventId: "event-00000001",
        source: "MANUAL",
        studentId: "student-1",
        deviceCapturedAt: "2026-09-21T07:30:00.000Z",
        rosterVersion: "cached-roster-v1",
        manualReason: "Card unreadable",
      },
    ],
  };
  return { ...base, ...overrides };
}

function fakeDb({
  existingEvents = [],
  currentAssignments = [],
  rosterAssignments = [],
  student = { id: "student-1" },
  device = null,
}: any = {}) {
  const createMany = vi.fn();
  const transactionDeviceCreate = vi.fn().mockResolvedValue({ id: "device-1" });
  const transactionDeviceUpdate = vi.fn().mockResolvedValue({ id: "device-1" });
  const tx = {
    transportDevice: {
      create: transactionDeviceCreate,
      update: transactionDeviceUpdate,
    },
    transportBoardingEvent: { createMany },
  };

  const assignmentFindMany = vi
    .fn()
    .mockResolvedValueOnce(currentAssignments)
    .mockResolvedValueOnce(rosterAssignments);

  const db: any = {
    transportTrip: {
      findUnique: vi.fn().mockResolvedValue({
        id: "trip-1",
        busId: "bus-1",
        serviceDate: new Date("2026-09-21T00:00:00.000Z"),
        direction: "TO_SCHOOL",
        status: "OPEN",
      }),
    },
    transportBoardingEvent: {
      findMany: vi
        .fn()
        .mockResolvedValueOnce(existingEvents)
        .mockResolvedValueOnce([]),
    },
    student: { findFirst: vi.fn().mockResolvedValue(student) },
    transportAssignment: { findMany: assignmentFindMany },
    transportBus: {
      findFirst: vi.fn().mockResolvedValue({ id: "bus-1", code: "BUS-01", capacity: 40 }),
    },
    transportDevice: { findUnique: vi.fn().mockResolvedValue(device) },
    $transaction: vi.fn(async (callback: any) => callback(tx)),
  };

  return { db: db as PrismaClient, createMany, assignmentFindMany };
}

describe("transport QR token contract", () => {
  beforeEach(() => {
    process.env.TRANSPORT_TOKEN_SECRET = "transport-test-secret-that-is-long-enough";
  });

  it("signs an opaque token without personal data and rejects tampering", () => {
    const token = signTransportQrToken({ cardId: "card-1", version: 1 });
    expect(token).toMatch(/^tr1\./);
    expect(token).not.toContain("student");
    expect(token).not.toContain("Ama");
    expect(verifyTransportQrToken(token)).toEqual({ cardId: "card-1", version: 1 });
    expect(verifyTransportQrToken(`${token}tampered`)).toBeNull();
  });
});

describe("TransportService.syncBatch", () => {
  it("accepts a wrong-bus boarding and reports both stale-roster and wrong-bus warnings", async () => {
    const { db, createMany } = fakeDb({
      currentAssignments: [{ studentId: "student-1", busId: "bus-2" }],
      // The student's current assignment is on another bus, so it is not in
      // the selected bus's current roster. The old cached version is still
      // accepted by the sync contract.
      rosterAssignments: [],
    });
    const service = new TransportService(db);

    const result = await service.syncBatch(syncInput());

    expect(result.acceptedCount).toBe(1);
    expect(result.rejectedCount).toBe(0);
    expect(result.warningCount).toBe(1);
    expect(result.results[0]).toMatchObject({
      status: "ACCEPTED",
      code: "BOARDED",
      studentId: "student-1",
      assignmentStatus: "UNASSIGNED",
      warnings: ["ROSTER_STALE", "WRONG_BUS"],
    });
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: [expect.objectContaining({
          clientEventId: "event-00000001",
          assignmentStatus: "UNASSIGNED",
          syncBatchId: "batch-00000001",
        })],
      }),
    );
  });

  it("returns an idempotent duplicate without writing a second event", async () => {
    const { db, createMany } = fakeDb({
      existingEvents: [{
        clientEventId: "event-00000001",
        studentId: "student-1",
        assignmentStatus: "ASSIGNED",
      }],
    });
    const service = new TransportService(db);

    const result = await service.syncBatch(syncInput({
      events: [{
        clientEventId: "event-00000001",
        source: "MANUAL",
        studentId: "student-1",
        deviceCapturedAt: "2026-09-21T07:30:00.000Z",
        manualReason: "Retry after network recovery",
      }],
    }));

    expect(result).toMatchObject({ acceptedCount: 0, duplicateCount: 1, rejectedCount: 0 });
    expect(result.results[0]).toMatchObject({
      status: "DUPLICATE",
      code: "CLIENT_EVENT_ALREADY_SYNCED",
      studentId: "student-1",
    });
    expect(createMany).not.toHaveBeenCalled();
  });

  it("counts a repeated client id in one batch once as accepted and once as duplicate", async () => {
    const { db } = fakeDb({
      currentAssignments: [{ studentId: "student-1", busId: "bus-1" }],
      rosterAssignments: [],
    });
    const service = new TransportService(db);

    const result = await service.syncBatch(syncInput({
      events: [
        {
          clientEventId: "event-00000003",
          source: "MANUAL",
          studentId: "student-1",
          deviceCapturedAt: "2026-09-21T07:32:00.000Z",
          manualReason: "Retry queued locally",
        },
        {
          clientEventId: "event-00000003",
          source: "MANUAL",
          studentId: "student-1",
          deviceCapturedAt: "2026-09-21T07:32:00.000Z",
          manualReason: "Retry queued locally",
        },
      ],
    }));

    expect(result).toMatchObject({ acceptedCount: 1, duplicateCount: 1, rejectedCount: 0 });
    expect(result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "ACCEPTED", clientEventId: "event-00000003" }),
      expect.objectContaining({ status: "DUPLICATE", code: "DUPLICATE_IN_BATCH" }),
    ]));
  });

  it("rejects an invalid QR token before creating a boarding event", async () => {
    const { db, createMany } = fakeDb();
    const service = new TransportService(db);

    const result = await service.syncBatch(syncInput({
      events: [{
        clientEventId: "event-00000002",
        source: "QR",
        qrToken: "tr1.invalid.invalid",
        studentId: "student-1",
        deviceCapturedAt: "2026-09-21T07:31:00.000Z",
      }],
    }));

    expect(result).toMatchObject({ acceptedCount: 0, duplicateCount: 0, rejectedCount: 1 });
    expect(result.results[0]).toMatchObject({ status: "REJECTED", code: "INVALID_TOKEN" });
    expect(createMany).not.toHaveBeenCalled();
  });
});

/**
 * openTrip lifecycle guard.
 *
 * The upsert's update branch resets status to OPEN and clears endedAt, so an
 * unguarded repeat POST against a completed run silently destroyed its
 * reconciliation boundary. These tests pin the guarded contract:
 *   - no trip            -> create
 *   - trip already OPEN  -> idempotent return, NO upsert (a live run is never
 *                           mutated by a retry)
 *   - trip CLOSED/CANCELLED without reopen:true -> 409
 *   - trip CLOSED with reopen:true -> reopened, endedAt cleared
 */
function tripDb({ bus = { id: "bus-1", code: "BUS-01", capacity: 40 }, existing = null }: any = {}) {
  const db: any = {
    transportBus: { findFirst: vi.fn().mockResolvedValue(bus) },
    transportTrip: {
      findUnique: vi.fn().mockResolvedValue(existing),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ ...existing, id: "trip-1" }),
      upsert: vi.fn().mockImplementation(async (args: any) => ({
        id: "trip-1",
        ...args.create,
        ...(existing ? args.update : {}),
      })),
    },
  };
  return { db: db as PrismaClient, upsert: db.transportTrip.upsert };
}

const OPEN_TRIP_INPUT = {
  busId: "bus-1",
  serviceDate: "2026-09-21",
  direction: "TO_SCHOOL" as const,
  reopen: false,
};

describe("TransportService.openTrip", () => {
  it("creates a trip when none exists for that bus/date/direction", async () => {
    const { db, upsert } = tripDb({ existing: null });
    const trip = await new TransportService(db).openTrip(OPEN_TRIP_INPUT);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(trip.busId).toBe("bus-1");
    expect(trip.direction).toBe("TO_SCHOOL");
  });

  it("returns an already-OPEN trip without mutating it", async () => {
    const { db, upsert } = tripDb({
      existing: { id: "trip-1", status: "OPEN", endedAt: null },
    });
    const trip = await new TransportService(db).openTrip(OPEN_TRIP_INPUT);
    expect(upsert).not.toHaveBeenCalled();
    expect(trip.id).toBe("trip-1");
  });

  it.each(["CLOSED", "CANCELLED"])(
    "refuses to silently reopen a %s trip",
    async (status) => {
      const { db, upsert } = tripDb({
        existing: { id: "trip-1", status, endedAt: new Date("2026-09-21T15:00:00.000Z") },
      });
      await expect(new TransportService(db).openTrip(OPEN_TRIP_INPUT)).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(upsert).not.toHaveBeenCalled();
    }
  );

  it("reopens a CLOSED trip when reopen is explicit, clearing endedAt", async () => {
    const { db, upsert } = tripDb({
      existing: { id: "trip-1", status: "CLOSED", endedAt: new Date("2026-09-21T15:00:00.000Z") },
    });
    await new TransportService(db).openTrip({ ...OPEN_TRIP_INPUT, reopen: true });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].update).toMatchObject({
      status: "OPEN",
      endedAt: null,
    });
  });

  it("rejects an inactive or unknown bus", async () => {
    const { db, upsert } = tripDb({ bus: null });
    await expect(new TransportService(db).openTrip(OPEN_TRIP_INPUT)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(upsert).not.toHaveBeenCalled();
  });
});
