import { EntityStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middleware/error.handler';
import { hashPassword } from '@/utils/hash';
import { formatInstitutionalId } from '@/utils';
import type {
  BootstrapSetupInput,
  SetupAcademicInput,
  SetupClassesInput,
  SetupCurriculumInput,
  SetupLedgerInput,
} from './setup.validation';

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

export const DEFAULT_LEDGER_ACCOUNTS: Array<{
  code: string;
  accountName: string;
  category: string;
}> = [
  { code: '1010', accountName: 'Cash and Bank Balances', category: 'ASSET' },
  { code: '1100', accountName: 'Mobile Money Clearing', category: 'ASSET' },
  { code: '1200', accountName: 'Student Fee Receivables', category: 'ASSET' },
  { code: '2010', accountName: 'Payroll Liabilities', category: 'LIABILITY' },
  { code: '2100', accountName: 'Accounts Payable', category: 'LIABILITY' },
  { code: '3010', accountName: 'Accumulated Fund / Equity', category: 'EQUITY' },
  { code: '4010', accountName: 'Tuition and Academic Fees', category: 'REVENUE' },
  { code: '4020', accountName: 'Boarding and Hostel Fees', category: 'REVENUE' },
  { code: '4030', accountName: 'Other Operating Income', category: 'REVENUE' },
  { code: '5010', accountName: 'Academic Operations Expense', category: 'EXPENSE' },
  { code: '5020', accountName: 'Staff Payroll Expense', category: 'EXPENSE' },
  { code: '5030', accountName: 'Utilities and Facilities', category: 'EXPENSE' },
];

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
            compliance: { create: {} },
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

  async saveAcademic(input: SetupAcademicInput): Promise<SetupStatus> {
    await this.assertWizardMutable();
    try {
      await prisma.$transaction(
        input.terms.map((term) =>
          prisma.term.upsert({
            where: { name: term.name },
            create: {
              name: term.name,
              academicYear: term.academicYear,
              startDate: new Date(term.startDate),
              endDate: new Date(term.endDate),
              isActive: term.isActive ?? true,
            },
            update: {
              academicYear: term.academicYear,
              startDate: new Date(term.startDate),
              endDate: new Date(term.endDate),
              isActive: term.isActive ?? true,
              deletedAt: null,
            },
          }),
        ),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'A term name conflict occurred. Use unique term names.');
      }
      throw error;
    }
    return this.getStatus();
  }

  async saveClasses(input: SetupClassesInput): Promise<SetupStatus> {
    await this.assertWizardMutable();
    const names = input.classes.map((c) => c.name);
    if (new Set(names).size !== names.length) {
      throw new AppError(400, 'Class names must be unique within the payload.');
    }
    try {
      await prisma.$transaction(
        input.classes.map((row) =>
          prisma.class.upsert({
            where: { name: row.name },
            create: {
              name: row.name,
              section: row.section ?? null,
              isActive: row.isActive ?? true,
            },
            update: {
              section: row.section ?? null,
              isActive: row.isActive ?? true,
              deletedAt: null,
            },
          }),
        ),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'A class name conflict occurred.');
      }
      throw error;
    }
    return this.getStatus();
  }

  async saveCurriculum(input: SetupCurriculumInput): Promise<SetupStatus> {
    await this.assertWizardMutable();
    const deptCodes = input.departments.map((d) => d.code);
    const subjectCodes = input.subjects.map((s) => s.code);
    if (new Set(deptCodes).size !== deptCodes.length) {
      throw new AppError(400, 'Department codes must be unique within the payload.');
    }
    if (new Set(subjectCodes).size !== subjectCodes.length) {
      throw new AppError(400, 'Subject codes must be unique within the payload.');
    }

    try {
      await prisma.$transaction(async (tx) => {
        for (const dept of input.departments) {
          await tx.department.upsert({
            where: { code: dept.code },
            create: { name: dept.name, code: dept.code, isActive: true },
            update: { name: dept.name, isActive: true, deletedAt: null },
          });
        }
        for (const subject of input.subjects) {
          await tx.subject.upsert({
            where: { code: subject.code },
            create: { name: subject.name, code: subject.code, isActive: true },
            update: { name: subject.name, isActive: true, deletedAt: null },
          });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          409,
          'A department or subject name/code conflict occurred. Codes and names must be unique.',
        );
      }
      throw error;
    }
    return this.getStatus();
  }

  async saveLedger(input: SetupLedgerInput): Promise<SetupStatus> {
    await this.assertWizardMutable();
    const accounts =
      input.useDefaults !== false && (!input.accounts || input.accounts.length === 0)
        ? DEFAULT_LEDGER_ACCOUNTS
        : (input.accounts ?? []);

    if (accounts.length === 0) {
      throw new AppError(400, 'Provide ledger accounts or set useDefaults to true.');
    }
    const codes = accounts.map((a) => a.code);
    if (new Set(codes).size !== codes.length) {
      throw new AppError(400, 'Ledger account codes must be unique within the payload.');
    }

    try {
      await prisma.$transaction(
        accounts.map((account) =>
          prisma.ledgerAccount.upsert({
            where: { code: account.code },
            create: {
              code: account.code,
              accountName: account.accountName,
              category: account.category,
              debit: 0,
              credit: 0,
            },
            update: {
              accountName: account.accountName,
              category: account.category,
              deletedAt: null,
            },
          }),
        ),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'A ledger account code conflict occurred.');
      }
      throw error;
    }
    return this.getStatus();
  }

  async complete(): Promise<SetupStatus> {
    const status = await this.getStatus();
    if (status.setupCompleted) {
      throw new AppError(409, 'First-start setup is already marked complete.');
    }
    if (!status.initialized) {
      throw new AppError(400, 'Create the school profile (bootstrap) before completing setup.');
    }
    if (!status.hasAdmin) {
      throw new AppError(400, 'An administrator account is required before completing setup.');
    }

    await prisma.systemConfig.update({
      where: { id: SYSTEM_CONFIG_ID },
      data: {
        setupCompletedAt: new Date(),
        setupVersion: SETUP_CONTRACT_VERSION,
      },
    });

    return this.getStatus();
  }

  private async assertWizardMutable(): Promise<void> {
    const status = await this.getStatus();
    if (status.setupCompleted) {
      throw new AppError(
        409,
        'First-start setup is complete. Use the normal admin screens to change configuration.',
      );
    }
    if (!status.initialized || !status.hasAdmin) {
      throw new AppError(
        400,
        'Complete bootstrap (school profile + administrator) before configuring this step.',
      );
    }
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
