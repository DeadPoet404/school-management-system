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

// ── routes and stops ────────────────────────────────────────────────────────
// The point of this increment is that a child belongs to a *stop on a route*,
// not merely to a vehicle. These cover the three behaviours that are easy to
// get subtly wrong: sequence allocation, stop-implies-route derivation, and
// direction-aware manifest ordering.

function rosterEntry(overrides: any = {}) {
  const studentId = overrides.studentId ?? "student-1";
  return {
    id: overrides.id ?? `assignment-${studentId}`,
    studentId,
    busId: overrides.busId ?? "bus-1",
    stopId: overrides.stop?.id ?? null,
    effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
    effectiveTo: null,
    bus: { id: "bus-1", code: "BUS-01" },
    route: overrides.route ?? null,
    stop: overrides.stop ?? null,
    student: {
      id: studentId,
      studentId: overrides.studentNumber ?? `SMS-${studentId}`,
      studentName: overrides.studentName ?? "Ama",
      status: "ACTIVE",
      placement: { class: { name: "JHS 1A" } },
      transportCards: [],
    },
  };
}

function rosterDb(entries: any[] = []) {
  return {
    transportBus: { findFirst: vi.fn().mockResolvedValue({ id: "bus-1", code: "BUS-01", capacity: 40 }) },
    transportAssignment: { findMany: vi.fn().mockResolvedValue(entries) },
  } as unknown as PrismaClient;
}

const STOP_A = { id: "stop-a", name: "First Gate", sequence: 1 };
const STOP_B = { id: "stop-b", name: "Second Gate", sequence: 2 };

function threeChildren() {
  return [
    rosterEntry({ studentId: "s1", studentName: "Zoe", stop: STOP_B }),
    rosterEntry({ studentId: "s2", studentName: "Ada", stop: null }),
    rosterEntry({ studentId: "s3", studentName: "Kojo", stop: STOP_A }),
  ];
}

describe("TransportService.getRoster stop ordering", () => {
  it("orders TO_SCHOOL by stop sequence and lists children with no stop last", async () => {
    const service = new TransportService(rosterDb(threeChildren()));
    const roster = await service.getRoster({ busId: "bus-1", serviceDate: "2026-09-22", direction: "TO_SCHOOL" });

    expect(roster.roster.map((row: any) => row.student.studentName)).toEqual(["Kojo", "Zoe", "Ada"]);
    expect(roster.stopManifest.map((row: any) => row.stopName)).toEqual(["First Gate", "Second Gate", "No stop assigned"]);
    expect(roster.stopManifest.map((row: any) => row.studentCount)).toEqual([1, 1, 1]);
  });

  it("reverses the stop order for FROM_SCHOOL rather than storing a second order", async () => {
    const service = new TransportService(rosterDb(threeChildren()));
    const roster = await service.getRoster({ busId: "bus-1", serviceDate: "2026-09-22", direction: "FROM_SCHOOL" });

    expect(roster.roster.map((row: any) => row.student.studentName)).toEqual(["Zoe", "Kojo", "Ada"]);
    expect(roster.stopManifest.map((row: any) => row.stopName)).toEqual(["Second Gate", "First Gate", "No stop assigned"]);
  });

  it("sorts children alphabetically within the same stop", async () => {
    const service = new TransportService(
      rosterDb([
        rosterEntry({ studentId: "s1", studentName: "Zoe", stop: STOP_A }),
        rosterEntry({ studentId: "s2", studentName: "Ada", stop: STOP_A }),
      ])
    );
    const roster = await service.getRoster({ busId: "bus-1", serviceDate: "2026-09-22", direction: "TO_SCHOOL" });
    expect(roster.roster.map((row: any) => row.student.studentName)).toEqual(["Ada", "Zoe"]);
    expect(roster.stopManifest).toHaveLength(1);
    expect(roster.stopManifest[0]?.studentCount).toBe(2);
  });

  it("bumps rosterVersion when a child moves to a different stop", async () => {
    const before = await new TransportService(rosterDb(threeChildren())).getRoster({
      busId: "bus-1",
      serviceDate: "2026-09-22",
      direction: "TO_SCHOOL",
    });
    const moved = threeChildren().map((entry) =>
      entry.studentId === "s1" ? rosterEntry({ studentId: "s1", studentName: "Zoe", stop: STOP_A }) : entry
    );
    const after = await new TransportService(rosterDb(moved)).getRoster({
      busId: "bus-1",
      serviceDate: "2026-09-22",
      direction: "TO_SCHOOL",
    });

    // A cached device roster must notice a stop change, or the driver keeps a
    // manifest that no longer matches who is standing at the gate.
    expect(after.rosterVersion).not.toEqual(before.rosterVersion);
  });
});

describe("TransportService.createStop", () => {
  function stopDb({ lastSequence = null, clash = null, route = { id: "route-1", code: "R1" } }: any = {}) {
    const create = vi.fn().mockResolvedValue({ id: "stop-new" });
    const db: any = {
      transportRoute: { findFirst: vi.fn().mockResolvedValue(route) },
      transportStop: {
        findFirst: vi.fn().mockResolvedValue(lastSequence === null ? null : { sequence: lastSequence }),
        findUnique: vi.fn().mockResolvedValue(clash),
        create,
      },
    };
    return { db: db as PrismaClient, create };
  }

  it("appends after the highest existing sequence when none is supplied", async () => {
    const { db, create } = stopDb({ lastSequence: 7 });
    await new TransportService(db).createStop("route-1", { name: "Junction", sequence: null, latitude: null, longitude: null });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ routeId: "route-1", sequence: 8 }) })
    );
  });

  it("starts at sequence 1 on an empty route", async () => {
    const { db, create } = stopDb({ lastSequence: null });
    await new TransportService(db).createStop("route-1", { name: "First", sequence: null, latitude: null, longitude: null });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sequence: 1 }) }));
  });

  it("rejects an explicit sequence already taken with 409 and does not write", async () => {
    const { db, create } = stopDb({ clash: { name: "Existing Stop" } });
    await expect(
      new TransportService(db).createStop("route-1", { name: "Duplicate", sequence: 3, latitude: null, longitude: null })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(create).not.toHaveBeenCalled();
  });

  it("404s when the route is missing or inactive", async () => {
    const { db, create } = stopDb({ route: null });
    await expect(
      new TransportService(db).createStop("route-1", { name: "Orphan", sequence: null, latitude: null, longitude: null })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("TransportService.createAssignment with a stop", () => {
  function assignmentDb({ stop = { id: "stop-1", routeId: "route-1", name: "First Gate" }, route = { id: "route-1", code: "R1" } }: any = {}) {
    const txCreate = vi.fn().mockResolvedValue({ id: "assignment-1" });
    const tx = { transportAssignment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), create: txCreate } };
    const db: any = {
      student: { findUnique: vi.fn().mockResolvedValue({ id: "s1", studentName: "Ama" }) },
      transportBus: { findFirst: vi.fn().mockResolvedValue({ id: "bus-1", code: "BUS-01" }) },
      transportStop: { findFirst: vi.fn().mockResolvedValue(stop) },
      transportRoute: { findFirst: vi.fn().mockResolvedValue(route) },
      $transaction: vi.fn(async (callback: any) => callback(tx)),
    };
    return { db: db as PrismaClient, txCreate };
  }

  const base = { studentId: "s1", busId: "bus-1", effectiveFrom: "2026-09-22T00:00:00.000Z" };

  it("derives the route from the stop so the two pickers cannot disagree", async () => {
    const { db, txCreate } = assignmentDb({});
    await new TransportService(db).createAssignment({ ...base, stopId: "stop-1" });
    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ routeId: "route-1", stopId: "stop-1" }) })
    );
  });

  it("rejects a stop that belongs to a different route than the one supplied", async () => {
    const { db, txCreate } = assignmentDb({ stop: { id: "stop-1", routeId: "route-OTHER", name: "First Gate" } });
    await expect(
      new TransportService(db).createAssignment({ ...base, stopId: "stop-1", routeId: "route-1" })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(txCreate).not.toHaveBeenCalled();
  });

  it("still creates a bus-only assignment when no stop is given", async () => {
    const { db, txCreate } = assignmentDb({});
    await new TransportService(db).createAssignment(base);
    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ routeId: null, stopId: null }) })
    );
  });

  it("404s when the stop is missing or inactive", async () => {
    const { db, txCreate } = assignmentDb({ stop: null });
    await expect(new TransportService(db).createAssignment({ ...base, stopId: "stop-gone" })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(txCreate).not.toHaveBeenCalled();
  });
});

describe("TransportService.createAssignment supersession", () => {
  it("closes a prior open assignment effective at the SAME instant, not only earlier ones", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const txCreate = vi.fn().mockResolvedValue({ id: "assignment-2" });
    const tx = { transportAssignment: { updateMany, create: txCreate } };
    const db: any = {
      student: { findUnique: vi.fn().mockResolvedValue({ id: "s1", studentName: "Ama" }) },
      transportBus: { findFirst: vi.fn().mockResolvedValue({ id: "bus-2", code: "BUS-02" }) },
      transportStop: { findFirst: vi.fn().mockResolvedValue(null) },
      transportRoute: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: any) => callback(tx)),
    };

    const effectiveFrom = "2027-01-01T00:00:00.000Z";
    await new TransportService(db as PrismaClient).createAssignment({
      studentId: "s1",
      busId: "bus-2",
      effectiveFrom,
    });

    // `lte` is the whole fix: with `lt` a same-instant re-assignment left two
    // open rows and the roster resolved the child to an arbitrary bus.
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: "s1",
          effectiveFrom: { lte: new Date(effectiveFrom) },
          effectiveTo: null,
        }),
      })
    );
  });
});
