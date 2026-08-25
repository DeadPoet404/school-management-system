import { prisma } from '@/lib/prisma';

export const SYSTEM_CONFIG_ID = 1;

/** Wizard contract version exposed to clients. */
export const SETUP_CONTRACT_VERSION = 1;

export interface SetupSteps {
  schoolProfile: boolean;
  adminAccount: boolean;
  academicTerms: boolean;
  classes: boolean;
  curriculum: boolean;
  ledger: boolean;
  completed: boolean;
}

export interface SetupStatus {
  /** True once a SystemConfig row exists (bootstrap has started). */
  initialized: boolean;
  /** True once POST /api/setup/complete has stamped setupCompletedAt. */
  setupCompleted: boolean;
  /** True when at least one StaffAccount with role ADMIN exists. */
  hasAdmin: boolean;
  schoolName: string | null;
  schoolCode: string | null;
  country: string | null;
  timezone: string | null;
  currency: string | null;
  setupVersion: number;
  steps: SetupSteps;
  /**
   * Frontend gate: when true, force /setup and block normal app shells.
   * Equivalent to !setupCompleted (wizard may still be mid-flight after bootstrap).
   */
  requiresSetup: boolean;
}

/**
 * First-start readiness probe. Public — no secrets, no PII beyond school name.
 */
export class SetupService {
  async getStatus(): Promise<SetupStatus> {
    const [config, adminCount, termCount, classCount, departmentCount, subjectCount, ledgerCount] =
      await Promise.all([
        prisma.systemConfig.findUnique({ where: { id: SYSTEM_CONFIG_ID } }),
        prisma.staffAccount.count({ where: { role: 'ADMIN' } }),
        prisma.term.count({ where: { deletedAt: null } }),
        prisma.class.count({ where: { deletedAt: null } }),
        prisma.department.count({ where: { deletedAt: null } }),
        prisma.subject.count({ where: { deletedAt: null } }),
        prisma.ledgerAccount.count({ where: { deletedAt: null } }),
      ]);

    const hasAdmin = adminCount > 0;
    const setupCompleted = config?.setupCompletedAt != null;
    const steps: SetupSteps = {
      schoolProfile: config != null,
      adminAccount: hasAdmin,
      academicTerms: termCount > 0,
      classes: classCount > 0,
      curriculum: departmentCount > 0 && subjectCount > 0,
      ledger: ledgerCount > 0,
      completed: setupCompleted,
    };

    return {
      initialized: config != null,
      setupCompleted,
      hasAdmin,
      schoolName: config?.schoolName ?? null,
      schoolCode: config?.schoolCode ?? null,
      country: config?.country ?? null,
      timezone: config?.timezone ?? null,
      currency: config?.currency ?? null,
      setupVersion: config?.setupVersion ?? SETUP_CONTRACT_VERSION,
      steps,
      requiresSetup: !setupCompleted,
    };
  }
}
