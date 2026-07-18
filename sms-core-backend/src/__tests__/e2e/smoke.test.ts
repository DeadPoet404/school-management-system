/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type -- test mocking requires loose types */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import supertest from 'supertest';
import type { PrismaClient } from '@prisma/client';

// ── Mock Prisma before any imports that touch the DB ──
// vi.mock is hoisted by Vitest, so this runs before the app import below.
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn().mockImplementation(async (fn: Function) => fn(mockPrisma)),
    // Add empty query builders for any route that might touch Prisma
    student: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), groupBy: vi.fn().mockResolvedValue([]) },
    staff: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
    teacher: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
    staffAccount: { findFirst: vi.fn().mockResolvedValue(null) },
    teacherAccount: { findFirst: vi.fn().mockResolvedValue(null) },
    studentAccount: { findFirst: vi.fn().mockResolvedValue(null) },
    refreshToken: { findUnique: vi.fn().mockResolvedValue(null), delete: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    paymentCollection: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    invoice: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn() },
    payment: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    billingLedger: { update: vi.fn(), upsert: vi.fn() },
    feeStructureConfiguration: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null), deleteMany: vi.fn(), create: vi.fn() },
    feeComponent: { findMany: vi.fn().mockResolvedValue([]) },
    ledgerAccount: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    staffPayroll: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
    teacherPayroll: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
    staffDeparture: { create: vi.fn() },
    studentDeparture: { create: vi.fn() },
    subjectAllocation: { findFirst: vi.fn().mockResolvedValue(null) },
    subject: { findUnique: vi.fn().mockResolvedValue(null) },
    class: { findUnique: vi.fn().mockResolvedValue(null) },
    feeTier: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  return { prisma: mockPrisma };
});

// ── Import app AFTER mock is established ──
// This triggers env validation, all middleware setup, and route registration
import app from '@/app';

describe('E2E Smoke Tests', () => {
  const request = supertest(app);

  describe('Health endpoint', () => {
    it('GET /api/health returns 200 with status and db info', async () => {
      const res = await request.get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toMatch(/healthy|degraded/);
      expect(res.body.data.uptime).toBeTypeOf('number');
      expect(res.body.data.db).toBeDefined();
      expect(res.body.data.db.status).toMatch(/connected|disconnected/);
      expect(res.body.data.timestamp).toBeDefined();
    });
  });

  describe('Auth routes — public', () => {
    it('POST /api/auth/login with no body returns validation error (not 500)', async () => {
      const res = await request.post('/api/auth/login').send({});

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Protected routes — reject unauthenticated', () => {
    it('GET /api/students returns 401 without token', async () => {
      const res = await request.get('/api/students');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/teachers returns 401 without token', async () => {
      const res = await request.get('/api/teachers');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/staff returns 401 without token', async () => {
      const res = await request.get('/api/staff');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/finance returns 401 without token', async () => {
      const res = await request.get('/api/finance/ledgers');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/grades returns 401 without token', async () => {
      const res = await request.post('/api/grades/submit').send({});

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/attendance returns 401 without token', async () => {
      const res = await request.get('/api/attendance');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/timetable returns 401 without token', async () => {
      const res = await request.get('/api/timetable');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('404 catch-all', () => {
    it('GET /api/nonexistent-route returns 404', async () => {
      const res = await request.get('/api/nonexistent-route');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });
  });
});
