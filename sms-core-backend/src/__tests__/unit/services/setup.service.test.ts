import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    systemConfig: { findUnique: vi.fn(), upsert: vi.fn() },
    staffAccount: { count: vi.fn(), findUnique: vi.fn() },
    studentAccount: { findUnique: vi.fn() },
    teacherAccount: { findUnique: vi.fn() },
    term: { count: vi.fn() },
    class: { count: vi.fn() },
    department: { count: vi.fn() },
    subject: { count: vi.fn() },
    ledgerAccount: { count: vi.fn() },
    staff: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/utils/hash', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-admin-password'),
}));

vi.mock('@/utils', () => ({
  formatInstitutionalId: vi.fn().mockReturnValue('STF-ADMIN-test01'),
}));

import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/utils/hash';
import { SetupService, SETUP_CONTRACT_VERSION } from '@/modules/setup/setup.service';
import { AppError } from '@/middleware/error.handler';

const mockedPrisma = prisma as unknown as {
  systemConfig: { findUnique: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
  staffAccount: { count: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  studentAccount: { findUnique: ReturnType<typeof vi.fn> };
  teacherAccount: { findUnique: ReturnType<typeof vi.fn> };
  term: { count: ReturnType<typeof vi.fn> };
  class: { count: ReturnType<typeof vi.fn> };
  department: { count: ReturnType<typeof vi.fn> };
  subject: { count: ReturnType<typeof vi.fn> };
  ledgerAccount: { count: ReturnType<typeof vi.fn> };
  staff: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
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

const BOOTSTRAP_INPUT = {
  school: {
    schoolName: 'Achimota School',
    schoolCode: 'ACH',
    motto: 'Ut Omnes Unum Sint',
    address: 'Accra',
    phone: '+233200000000',
    email: 'info@achimota.edu.gh',
    country: 'GH',
    timezone: 'Africa/Accra',
    currency: 'GHS',
  },
  admin: {
    fullName: 'Ama Mensah',
    email: 'ama.mensah@achimota.edu.gh',
    password: 'SecureAdmin1',
  },
};

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
      hasAdmin: false,
      requiresSetup: true,
      setupVersion: SETUP_CONTRACT_VERSION,
    });
  });

  it('clears requiresSetup once setupCompletedAt is stamped', async () => {
    mockCounts({
      config: {
        id: 1,
        schoolName: 'Done',
        schoolCode: 'DONE',
        country: 'GH',
        timezone: 'Africa/Accra',
        currency: 'GHS',
        setupCompletedAt: new Date(),
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
  });
});

describe('SetupService.bootstrap', () => {
  let service: SetupService;

  beforeEach(() => {
    service = new SetupService();
    vi.clearAllMocks();
    mockedPrisma.studentAccount.findUnique.mockResolvedValue(null);
    mockedPrisma.staffAccount.findUnique.mockResolvedValue(null);
    mockedPrisma.teacherAccount.findUnique.mockResolvedValue(null);
    mockedPrisma.term.count.mockResolvedValue(0);
    mockedPrisma.class.count.mockResolvedValue(0);
    mockedPrisma.department.count.mockResolvedValue(0);
    mockedPrisma.subject.count.mockResolvedValue(0);
    mockedPrisma.ledgerAccount.count.mockResolvedValue(0);
  });

  it('creates school config + ADMIN on a cold database', async () => {
    let bootstrapped = false;
    mockedPrisma.systemConfig.findUnique.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      if ('schoolCode' in args.where) return null;
      if (!bootstrapped) return null;
      return {
        id: 1,
        schoolName: 'Achimota School',
        schoolCode: 'ACH',
        country: 'GH',
        timezone: 'Africa/Accra',
        currency: 'GHS',
        setupCompletedAt: null,
        setupVersion: 1,
      };
    });
    mockedPrisma.staffAccount.count.mockImplementation(async () => (bootstrapped ? 1 : 0));
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        systemConfig: {
          upsert: vi.fn().mockImplementation(async () => {
            bootstrapped = true;
            return {};
          }),
        },
        staffAccount: { count: vi.fn().mockResolvedValue(0) },
        staff: {
          create: vi.fn().mockImplementation(async () => {
            bootstrapped = true;
            return {};
          }),
        },
      };
      return fn(tx);
    });

    const result = await service.bootstrap(BOOTSTRAP_INPUT);
    expect(hashPassword).toHaveBeenCalledWith('SecureAdmin1');
    expect(result.admin.email).toBe('ama.mensah@achimota.edu.gh');
    expect(result.admin.role).toBe('ADMIN');
    expect(result.status.hasAdmin).toBe(true);
    expect(result.status.initialized).toBe(true);
  });

  it('rejects bootstrap when an ADMIN already exists', async () => {
    mockCounts({
      config: null,
      admins: 1,
    });
    await expect(service.bootstrap(BOOTSTRAP_INPUT)).rejects.toBeInstanceOf(AppError);
    await expect(service.bootstrap(BOOTSTRAP_INPUT)).rejects.toMatchObject({ statusCode: 409 });
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects bootstrap when email is already registered', async () => {
    mockCounts({});
    mockedPrisma.staffAccount.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.bootstrap(BOOTSTRAP_INPUT)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('maps unique constraint failures to 409', async () => {
    mockCounts({});
    mockedPrisma.systemConfig.findUnique.mockResolvedValue(null);
    mockedPrisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(service.bootstrap(BOOTSTRAP_INPUT)).rejects.toMatchObject({ statusCode: 409 });
  });
});
