import { EntityStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middleware/error.handler';
import { hashPassword } from '@/utils/hash';
import { formatInstitutionalId } from '@/utils';
import type { BootstrapSetupInput } from './setup.validation';

export const SYSTEM_CONFIG_ID = 1;
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
  initialized: boolean;
  setupCompleted: boolean;
  hasAdmin: boolean;
  schoolName: string | null;
  schoolCode: string | null;
  country: string | null;
  timezone: string | null;
  currency: string | null;
  setupVersion: number;
  steps: SetupSteps;
  requiresSetup: boolean;
}

export interface BootstrapResult {
  status: SetupStatus;
  admin: {
    email: string;
    fullName: string;
    staffId: string;
    role: 'ADMIN';
  };
}

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

  /**
   * Public one-shot bootstrap: SystemConfig + founding ADMIN.
   * Rejected once an ADMIN exists or setup has been marked complete.
   */
  async bootstrap(input: BootstrapSetupInput): Promise<BootstrapResult> {
    const email = input.admin.email.trim().toLowerCase();
    const schoolCode = input.school.schoolCode;

    const existingStatus = await this.getStatus();
    if (existingStatus.setupCompleted) {
      throw new AppError(
        409,
        'This school has already completed first-start setup. Sign in with an administrator account.',
      );
    }
    if (existingStatus.hasAdmin) {
      throw new AppError(
        409,
        'An administrator account already exists. Sign in to continue the setup wizard.',
      );
    }

    await this.assertEmailAvailable(email);

    if (!existingStatus.initialized) {
      const codeTaken = await prisma.systemConfig.findUnique({ where: { schoolCode } });
      if (codeTaken) {
        throw new AppError(409, 'That school code is already in use.');
      }
    }

    const passwordHash = await hashPassword(input.admin.password);
    const staffBusinessId = formatInstitutionalId('STF', 'ADMIN');

    try {
      await prisma.$transaction(async (tx) => {
        await tx.systemConfig.upsert({
          where: { id: SYSTEM_CONFIG_ID },
          create: {
            id: SYSTEM_CONFIG_ID,
            schoolName: input.school.schoolName,
            schoolCode,
            motto: input.school.motto ?? null,
            address: input.school.address ?? null,
            phone: input.school.phone ?? null,
            email: input.school.email ?? null,
            country: input.school.country,
            timezone: input.school.timezone,
            currency: input.school.currency,
            setupVersion: SETUP_CONTRACT_VERSION,
            setupCompletedAt: null,
          },
          update: {
            schoolName: input.school.schoolName,
            schoolCode,
            motto: input.school.motto ?? null,
            address: input.school.address ?? null,
            phone: input.school.phone ?? null,
            email: input.school.email ?? null,
            country: input.school.country,
            timezone: input.school.timezone,
            currency: input.school.currency,
            setupVersion: SETUP_CONTRACT_VERSION,
          },
        });

        const adminInside = await tx.staffAccount.count({ where: { role: 'ADMIN' } });
        if (adminInside > 0) {
          throw new AppError(
            409,
            'An administrator account already exists. Sign in to continue the setup wizard.',
          );
        }

        await tx.staff.create({
          data: {
            staffId: staffBusinessId,
            staffName: input.admin.fullName,
            appointmentDate: new Date(),
            status: EntityStatus.ACTIVE,
            account: {
              create: {
                email,
                passwordHash,
                role: 'ADMIN',
              },
            },
            placement: {
              create: {
                departmentId: 'ADMINISTRATION',
                jobTitle: 'System Administrator',
                employmentType: 'Full-Time',
                shiftSchedule: 'Standard Day',
              },
            },
            demographics: {
              create: {
                dateOfBirth: new Date('1990-01-01'),
                gender: 'UNSPECIFIED',
                residentialAddress: input.school.address?.trim() || 'Not provided',
                phone: input.school.phone?.trim() || 'N/A',
              },
            },
            compliance: {
              create: {},
            },
            payroll: {
              create: {
                clearanceTier: 'Level 3: Executive',
                baseSalary: 0,
                deductions: 0,
                netPay: 0,
                salaryStatus: 'PENDING',
              },
            },
          },
        });
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          409,
          'A unique field conflict occurred during bootstrap (email or school code). Retry with different values.',
        );
      }
      throw error;
    }

    const status = await this.getStatus();
    return {
      status,
      admin: {
        email,
        fullName: input.admin.fullName,
        staffId: staffBusinessId,
        role: 'ADMIN',
      },
    };
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const [student, staff, teacher] = await Promise.all([
      prisma.studentAccount.findUnique({ where: { portalEmail: email }, select: { id: true } }),
      prisma.staffAccount.findUnique({ where: { email }, select: { id: true } }),
      prisma.teacherAccount.findUnique({ where: { email }, select: { id: true } }),
    ]);

    if (student || staff || teacher) {
      throw new AppError(409, 'That email address is already registered on this system.');
    }
  }
}
