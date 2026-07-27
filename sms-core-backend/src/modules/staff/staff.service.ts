import { AppError } from '@/middleware/error.handler';
import { prisma } from "@/lib/prisma";
import { PersonnelDepartureType, EntityStatus, ClearanceStatus, Prisma } from "@prisma/client";
import { IStaffRepository } from "@/types/repositories";
import { StaffRepository } from "./staff.repository";
import { formatInstitutionalId } from "@/utils";
import { hashPassword } from "@/utils/hash";
import { parseStaffImportFile, type StaffImportError, type StaffImportUploadedFile } from "./staff.import";

type StaffWithRelations = Prisma.StaffGetPayload<{
  include: {
    account: true;
    demographics: true;
    placement: true;
    compliance: true;
    payroll: true;
    departures: true;
  };
}>;

export class StaffService {
  constructor(private repo: IStaffRepository = new StaffRepository()) {}

  private mapStaff(staff: StaffWithRelations) {
    return {
      ...staff,
      account: {
        fullName: staff.staffName,
        email: staff.account?.email ?? "—",
        role: staff.account?.role ?? "STAFF",
      },
      placement: {
        departmentId: staff.placement?.departmentId ?? "OPERATIONS",
        jobTitle: staff.placement?.jobTitle ?? "General Staff Line",
        employmentType: staff.placement?.employmentType ?? "Full-Time",
        shiftSchedule: staff.placement?.shiftSchedule ?? "Standard Shift",
      },
      demographics: {
        phone: staff.demographics?.phone ?? null,
        formerSchool: staff.demographics?.formerSchool ?? null,
        gender: staff.demographics?.gender ?? null,
        dateOfBirth: staff.demographics?.dateOfBirth ?? null,
        bloodType: staff.demographics?.bloodType ?? null,
        religion: staff.demographics?.religion ?? null,
        residentialAddress: staff.demographics?.residentialAddress ?? null,
      },
      compliance: {
        nationalId: staff.compliance?.nationalId ?? null,
        ssnitNumber: staff.compliance?.ssnitNumber ?? null,
        emergencyName: staff.compliance?.emergencyName ?? null,
        emergencyPhone: staff.compliance?.emergencyPhone ?? null,
      },
      payroll: {
        baseSalary: staff.payroll?.baseSalary ? Number(staff.payroll.baseSalary) : 0.00,
        deductions: staff.payroll?.deductions ? Number(staff.payroll.deductions) : 0.00,
        netPay: staff.payroll?.netPay ? Number(staff.payroll.netPay) : 0.00,
        bankName: staff.payroll?.bankName ?? "Unconfigured Bank",
        bankAccount: staff.payroll?.bankAccount ?? "—",
        salaryStatus: staff.payroll?.salaryStatus ?? "PENDING",
      }
    };
  }

  async getAllStaff() {
    const rawStaff = await this.repo.findAllActive();
    return (rawStaff as StaffWithRelations[]).map((staff) => this.mapStaff(staff));
  }

  async getPaginatedStaff(skip: number, take: number) {
    return this.getFilteredPaginated({}, skip, take);
  }

  async getAllFiltered(filters: {
    search?: string;
    status?: string;
    departmentId?: string;
    jobTitle?: string;
    employmentType?: string;
    gender?: string;
  }) {
    const where = this.buildWhereClause(filters);
    const raw = await this.repo.findAllFiltered(where);
    return (raw as StaffWithRelations[]).map((s) => this.mapStaff(s));
  }

    async getFilteredPaginated(filters: {
    search?: string;
    status?: string;
    departmentId?: string;
    jobTitle?: string;
    employmentType?: string;
    gender?: string;
  }, skip: number, take: number) {
    const where = this.buildWhereClause(filters);
    const [rawStaff, total] = await Promise.all([
      this.repo.findAllFiltered(where, skip, take),
      this.repo.countFiltered(where),
    ]);
    return {
      data: (rawStaff as StaffWithRelations[]).map((s) => this.mapStaff(s)),
      total,
    };
  }

  private buildWhereClause(filters: {
    search?: string;
    status?: string;
    departmentId?: string;
    jobTitle?: string;
    employmentType?: string;
    gender?: string;
  }): Prisma.StaffWhereInput {
    const where: Prisma.StaffWhereInput = {};

    // Default: exclude DEPARTED unless explicitly requested
    if (filters.status?.trim()) {
      where.status = filters.status.trim() as EntityStatus;
    } else {
      where.status = { not: "DEPARTED" };
    }

    if (filters.search?.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { staffName: { contains: term, mode: 'insensitive' } },
        { staffId: { contains: term, mode: 'insensitive' } },
      ];
    }

    const placementFilter: Prisma.StaffPlacementWhereInput = {};
    if (filters.departmentId?.trim()) {
      placementFilter.departmentId = filters.departmentId.trim();
    }
    if (filters.jobTitle?.trim()) {
      placementFilter.jobTitle = { contains: filters.jobTitle.trim(), mode: 'insensitive' };
    }
    if (filters.employmentType?.trim()) {
      placementFilter.employmentType = filters.employmentType.trim();
    }
    if (Object.keys(placementFilter).length > 0) {
      where.placement = placementFilter;
    }

    if (filters.gender?.trim()) {
      where.demographics = { gender: filters.gender.trim() };
    }

    return where;
  }

  async getById(id: string) {
    const staff = await this.repo.findById(id);
    if (!staff) throw new AppError(404, `Staff member not found with ID: ${id}`);
    return this.mapStaff(staff as StaffWithRelations);
  }

  async getWorkforceMatrix() {
    const rawStaff = await this.repo.findAllActive();

    return (rawStaff as StaffWithRelations[]).map((member: StaffWithRelations) => ({
      id: member.staffId,
      internalId: member.id,
      staffName: member.staffName,
      email: member.account?.email || "—",
      role: member.account?.role || "STAFF",
      departmentId: member.placement?.departmentId || "UNASSIGNED",
      jobTitle: member.placement?.jobTitle || "General Staff",
      employmentType: member.placement?.employmentType || "Full-Time",
      shiftSchedule: member.placement?.shiftSchedule || "Standard Day",
      status: member.status,
    }));
  }

  async getPerformanceMetrics() {
    const rawStaff = await this.repo.findAllActive();
    const now = Date.now();

    const percent = (values: unknown[]) => {
      if (values.length === 0) return 0;
      const complete = values.filter(Boolean).length;
      return Math.round((complete / values.length) * 100);
    };

    return (rawStaff as StaffWithRelations[]).map((member) => {
      const appointmentTime = member.appointmentDate
        ? new Date(member.appointmentDate).getTime()
        : Number.NaN;

      const tenureDays = Number.isFinite(appointmentTime)
        ? Math.max(0, Math.floor((now - appointmentTime) / (1000 * 60 * 60 * 24)))
        : 0;

      const profileCompleteness = percent([
        member.staffName,
        member.appointmentDate,
        member.account?.email,
        member.account?.role,
        member.demographics?.dateOfBirth,
        member.demographics?.gender,
        member.demographics?.residentialAddress,
        member.demographics?.phone,
        member.placement?.departmentId,
        member.placement?.jobTitle,
        member.placement?.employmentType,
        member.placement?.shiftSchedule,
      ]);

      const complianceScore = percent([
        member.compliance?.nationalId,
        member.compliance?.ssnitNumber,
        member.compliance?.emergencyName,
        member.compliance?.emergencyPhone,
      ]);

      const payrollReadiness = percent([
        member.payroll?.clearanceTier,
        Number(member.payroll?.baseSalary ?? 0) > 0,
        member.payroll?.bankName,
        member.payroll?.bankAccount,
        member.payroll?.salaryStatus,
      ]);

      const statusScore =
        member.status === EntityStatus.ACTIVE
          ? 100
          : member.status === EntityStatus.DEPARTED
            ? 0
            : 60;

      const performanceScore = Math.round(
        profileCompleteness * 0.35 +
        complianceScore * 0.25 +
        payrollReadiness * 0.25 +
        statusScore * 0.15
      );

      const reviewStatus =
        performanceScore >= 85
          ? "On Track"
          : performanceScore >= 65
            ? "Needs Review"
            : "Action Required";

      return {
        id: member.id,
        staffId: member.staffId,
        staffName: member.staffName,
        email: member.account?.email ?? null,
        role: member.account?.role ?? "STAFF",
        departmentId: member.placement?.departmentId ?? "UNASSIGNED",
        jobTitle: member.placement?.jobTitle ?? "General Staff",
        employmentType: member.placement?.employmentType ?? "Full-Time",
        shiftSchedule: member.placement?.shiftSchedule ?? "Standard Day",
        status: member.status,
        tenureDays,
        profileCompleteness,
        complianceScore,
        payrollReadiness,
        performanceScore,
        reviewStatus,
        attendanceRate: null,
        punctualityRate: null,
        taskCompletionRate: null,
        metricsSource: "staff_registry",
        notes: "Attendance, punctuality, and task completion metrics require dedicated staff attendance/task modules before they can be calculated.",
      };
    });
  }

  async createStaff(payload: {
    account: {
      fullName: string;
      email: string;
      password: string;
      employmentDate: string;
      role?: string;
    };
    demographics: {
      dateOfBirth: string;
      gender: string;
      residentialAddress: string;
      phone: string;
      bloodType?: string | null;
      religion?: string | null;
      formerSchool?: string | null;
    };
    placement: {
      departmentId: string;
      jobTitle: string;
      employmentType: string;
      shiftSchedule: string;
    };
    compliance?: {
      nationalId?: string | null;
      ssnitNumber?: string | null;
      emergencyContact?: {
        name?: string | null;
        phone?: string | null;
      } | null;
    };
    payroll: {
      clearanceTier: string;
      baseSalary: string | number;
      bankName?: string | null;
      bankAccount?: string | null;
    };
  }) {
    const { account, demographics, placement, compliance, payroll } = payload;

    const deptPrefix = placement.departmentId ? placement.departmentId.replace("dept-", "").toUpperCase() : "STF";
    const generatedStaffId = formatInstitutionalId('STF', deptPrefix);
    
    return await prisma.$transaction(async (tx) => {
      const hashedPassword = await hashPassword(account.password);

      const completeDbPayload: Prisma.StaffCreateInput = {
        staffId: generatedStaffId,
        staffName: account.fullName,
        appointmentDate: new Date(account.employmentDate),
        status: EntityStatus.ACTIVE,

        account: {
          create: {
            email: account.email,
            passwordHash: hashedPassword,
            role: account.role || "STAFF",
          },
        },

        demographics: {
          create: {
            dateOfBirth: new Date(demographics.dateOfBirth),
            gender: demographics.gender,
            residentialAddress: demographics.residentialAddress,
            phone: demographics.phone,
            bloodType: demographics.bloodType || null,
            religion: demographics.religion || null,
            formerSchool: demographics.formerSchool || null,
          },
        },

        placement: {
          create: {
            departmentId: placement.departmentId,
            jobTitle: placement.jobTitle,
            employmentType: placement.employmentType,
            shiftSchedule: placement.shiftSchedule,
          },
        },

        compliance: {
          create: {
            nationalId: compliance?.nationalId || null,
            ssnitNumber: compliance?.ssnitNumber || null,
            emergencyName: compliance?.emergencyContact?.name || null,
            emergencyPhone: compliance?.emergencyContact?.phone || null,
          },
        },

        payroll: {
          create: {
            clearanceTier: payroll.clearanceTier,
            baseSalary: payroll.baseSalary ? parseFloat(payroll.baseSalary as string) : 0,
            deductions: 0,
            netPay: payroll.baseSalary ? parseFloat(payroll.baseSalary as string) : 0,
            bankName: payroll.bankName || null,
            bankAccount: payroll.bankAccount || null,
            salaryStatus: "PENDING",
          },
        },
      };

      const staff = await this.repo.createNestedStaff(completeDbPayload, tx);

      return {
        id: staff.id,
        staffId: staff.staffId,
        staffName: staff.staffName,
      };
    });
  }

  async importStaffFromFile(file: StaffImportUploadedFile) {
    const parsed = parseStaffImportFile(file);
    const errors: StaffImportError[] = [...parsed.errors];
    const createdStaff: Array<{ row: number; id: string; staffId: string; staffName: string }> = [];
    const seenEmails = new Set<string>();
    const departmentCache = new Map<string, string>();

    for (const row of parsed.rows) {
      try {
        const emailKey = row.payload.account.email.trim().toLowerCase();

        if (seenEmails.has(emailKey)) {
          throw new AppError(409, `Duplicate email ${row.payload.account.email} appears more than once in the import file.`);
        }

        seenEmails.add(emailKey);

        const existingAccount = await prisma.staffAccount.findUnique({
          where: { email: row.payload.account.email },
        });

        if (existingAccount) {
          throw new AppError(409, `Staff account email already exists: ${row.payload.account.email}`);
        }

        const departmentId = await this.resolveImportDepartmentId(row.payload.placement.departmentId, departmentCache);

        const created = await this.createStaff({
          ...row.payload,
          placement: {
            ...row.payload.placement,
            departmentId,
          },
        });

        createdStaff.push({
          row: row.rowNumber,
          id: created.id,
          staffId: created.staffId,
          staffName: created.staffName,
        });
      } catch (error) {
        errors.push({
          row: row.rowNumber,
          message: error instanceof Error ? error.message : "Staff import failed for this row.",
        });
      }
    }

    const failedRows = new Set(errors.map((error) => error.row));

    return {
      totalRows: parsed.totalRows,
      attemptedRows: parsed.rows.length,
      created: createdStaff.length,
      failed: failedRows.size,
      errors,
      createdStaff,
    };
  }

  private async resolveImportDepartmentId(value: string, cache: Map<string, string>): Promise<string> {
    const lookup = value.trim();
    const cacheKey = lookup.toLowerCase();
    const cached = cache.get(cacheKey);

    if (cached) return cached;

    const byId = await prisma.department.findFirst({
      where: { id: lookup, deletedAt: null, isActive: true },
      select: { id: true },
    });

    const found = byId ?? await prisma.department.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { code: { equals: lookup, mode: "insensitive" } },
          { name: { equals: lookup, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (!found) {
      throw new AppError(400, `Unknown active department: ${lookup}`);
    }

    cache.set(cacheKey, found.id);
    return found.id;
  }

  async processDeparture(payload: {
    staffId: string;
    departureType: string;
    effectiveDate: string;
    clearance: {
      hr: string;
      itAssets: string;
      treasury: string;
    };
    remarks: string;
  }) {
    const { staffId, departureType, effectiveDate, clearance, remarks } = payload;

    return await prisma.$transaction(async (tx) => {
      const staffRecord = await this.repo.findByPublicId(staffId, tx);

      if (!staffRecord) {
        throw new AppError(404, `Target staff lookup failed. No active record found for ID: ${staffId}`);
      }

      if (staffRecord.status === EntityStatus.DEPARTED) {
        throw new AppError(409, `System conflict: Staff member ${staffId} has already been processed for departure.`);
      }

      const departureLog = await this.repo.createDepartureLog({
        staffInternalId: staffRecord.id,
        departureType: departureType as PersonnelDepartureType,
        effectiveDate: new Date(effectiveDate),
        hrClearanceStatus: clearance.hr as ClearanceStatus,
        itAssetReturnStatus: clearance.itAssets as ClearanceStatus,
        treasuryClearanceStatus: clearance.treasury as ClearanceStatus,
        remarks,
      }, tx);

      await this.repo.updateStatus(staffRecord.id, EntityStatus.DEPARTED, tx);

      return departureLog;
    });
  }

  async update(id: string, payload: Record<string, unknown>) {
    const staff = await this.repo.findById(id);
    if (!staff) throw new AppError(404, `Staff member not found with ID: ${id}`);
    if (staff.status === 'DEPARTED') throw new AppError(409, 'Cannot update a departed staff member.');

    const data: Record<string, unknown> = { ...payload };
    const demo = data.demographics as Record<string, unknown> | undefined;
    if (demo?.dateOfBirth && typeof demo.dateOfBirth === 'string') {
      demo.dateOfBirth = new Date(demo.dateOfBirth);
    }
    if (data.payroll) {
      const pay = data.payroll as Record<string, unknown>;
      if (pay.baseSalary !== undefined) pay.baseSalary = parseFloat(String(pay.baseSalary)) || 0;
      if (pay.deductions !== undefined) pay.deductions = parseFloat(String(pay.deductions)) || 0;
      const base = typeof pay.baseSalary === "number" ? pay.baseSalary : 0;
      const ded = typeof pay.deductions === "number" ? pay.deductions : 0;
      pay.netPay = Math.max(0, base - ded);
    }

    return this.repo.update(id, data);
  }

}
