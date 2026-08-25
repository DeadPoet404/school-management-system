import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    systemConfig: { findUnique: vi.fn() },
    staffAccount: { count: vi.fn() },
    term: { count: vi.fn() },
    class: { count: vi.fn() },
    department: { count: vi.fn() },
    subject: { count: vi.fn() },
    ledgerAccount: { count: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { SetupService, SETUP_CONTRACT_VERSION } from '@/modules/setup/setup.service';

const mockedPrisma = prisma as unknown as {
  systemConfig: { findUnique: ReturnType<typeof vi.fn> };
  staffAccount: { count: ReturnType<typeof vi.fn> };
  term: { count: ReturnType<typeof vi.fn> };
  class: { count: ReturnType<typeof vi.fn> };
  department: { count: ReturnType<typeof vi.fn> };
  subject: { count: ReturnType<typeof vi.fn> };
  ledgerAccount: { count: ReturnType<typeof vi.fn> };
};

function mockCounts(partial: {
  config?: unknown;
  admins?: number;
  terms?: number;
  classes?: number;
  departments?: number;
  subjects?: number;
  ledger?: number;
}) {
  mockedPrisma.systemConfig.findUnique.mockResolvedValue(partial.config ?? null);
  mockedPrisma.staffAccount.count.mockResolvedValue(partial.admins ?? 0);
  mockedPrisma.term.count.mockResolvedValue(partial.terms ?? 0);
  mockedPrisma.class.count.mockResolvedValue(partial.classes ?? 0);
  mockedPrisma.department.count.mockResolvedValue(partial.departments ?? 0);
  mockedPrisma.subject.count.mockResolvedValue(partial.subjects ?? 0);
  mockedPrisma.ledgerAccount.count.mockResolvedValue(partial.ledger ?? 0);
}

describe('SetupService.getStatus', () => {
  let service: SetupService;

  beforeEach(() => {
    service = new SetupService();
    vi.clearAllMocks();
  });

  it('reports a cold empty database as requiring setup', async () => {
    mockCounts({});

    const status = await service.getStatus();

    expect(status).toMatchObject({
      initialized: false,
      setupCompleted: false,
      hasAdmin: false,
      schoolName: null,
      schoolCode: null,
      requiresSetup: true,
      setupVersion: SETUP_CONTRACT_VERSION,
      steps: {
        schoolProfile: false,
        adminAccount: false,
        academicTerms: false,
        classes: false,
        curriculum: false,
        ledger: false,
        completed: false,
      },
    });
  });

  it('marks school profile step when SystemConfig exists but setup is incomplete', async () => {
    mockCounts({
      config: {
        id: 1,
        schoolName: 'Achimota SHS',
        schoolCode: 'ACH',
        country: 'GH',
        timezone: 'Africa/Accra',
        currency: 'GHS',
        setupCompletedAt: null,
        setupVersion: 1,
      },
      admins: 1,
      terms: 3,
      classes: 6,
      departments: 4,
      subjects: 12,
      ledger: 8,
    });

    const status = await service.getStatus();

    expect(status.initialized).toBe(true);
    expect(status.setupCompleted).toBe(false);
    expect(status.requiresSetup).toBe(true);
    expect(status.hasAdmin).toBe(true);
    expect(status.schoolName).toBe('Achimota SHS');
    expect(status.schoolCode).toBe('ACH');
    expect(status.steps).toEqual({
      schoolProfile: true,
      adminAccount: true,
      academicTerms: true,
      classes: true,
      curriculum: true,
      ledger: true,
      completed: false,
    });
  });

  it('requires both departments and subjects for the curriculum step', async () => {
    mockCounts({
      config: {
        id: 1,
        schoolName: 'Test',
        schoolCode: 'TST',
        country: 'GH',
        timezone: 'Africa/Accra',
        currency: 'GHS',
        setupCompletedAt: null,
        setupVersion: 1,
      },
      departments: 2,
      subjects: 0,
    });

    const status = await service.getStatus();
    expect(status.steps.curriculum).toBe(false);
  });

  it('clears requiresSetup once setupCompletedAt is stamped', async () => {
    const completedAt = new Date('2026-08-25T12:00:00.000Z');
    mockCounts({
      config: {
        id: 1,
        schoolName: 'Done School',
        schoolCode: 'DONE',
        country: 'GH',
        timezone: 'Africa/Accra',
        currency: 'GHS',
        setupCompletedAt: completedAt,
        setupVersion: 1,
      },
      admins: 1,
      terms: 1,
      classes: 1,
      departments: 1,
      subjects: 1,
      ledger: 1,
    });

    const status = await service.getStatus();

    expect(status.setupCompleted).toBe(true);
    expect(status.requiresSetup).toBe(false);
    expect(status.steps.completed).toBe(true);
  });
});
