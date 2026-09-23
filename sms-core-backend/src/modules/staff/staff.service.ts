import { AppError } from '@/middleware/error.handler';
import { prisma } from "@/lib/prisma";
import { capStringFields } from "@/lib/capitalize";
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
        employmentType: staff.placement?.employmentType ?? "FULL-TIME",
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
      // 2026-09: search targets the staff member's name only.
      where.staffName = { contains: filters.search.trim(), mode: 'insensitive' };
    }

    const placementFilter: Prisma.StaffPlacementWhereInput = {};
    if (filters.departmentId?.trim()) {
      placementFilter.departmentId = filters.departmentId.trim();
    }
    if (filters.jobTitle?.trim()) {
      placementFilter.jobTitle = { contains: filters.jobTitle.trim(), mode: 'insensitive' };
    }
    if (filters.employmentType?.trim()) {
      // 2026-09: values are stored in capitals ("no small letters" rule) —
      // keep the filter tolerant of whatever case the UI sends.
      placementFilter.employmentType = { equals: filters.employmentType.trim(), mode: 'insensitive' };
    }
    if (Object.keys(placementFilter).length > 0) {
      where.placement = placementFilter;
    }

    if (filters.gender?.trim()) {
      where.demographics = { gender: { equals: filters.gender.trim(), mode: 'insensitive' } };
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
      employmentType: member.placement?.employmentType || "FULL-TIME",
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
        employmentType: member.placement?.employmentType ?? "FULL-TIME",
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
      employmentDate?: string;
      role?: string;
    };
    demographics?: {
      dateOfBirth?: string;
      gender?: string;
      residentialAddress?: string;
      phone?: string;
      bloodType?: string | null;
      religion?: string | null;
      formerSchool?: string | null;
    } | null;
    placement?: {
      departmentId?: string;
      jobTitle?: string;
      employmentType?: string;
      shiftSchedule?: string;
    } | null;
    compliance?: {
      nationalId?: string | null;
      ssnitNumber?: string | null;
      emergencyContact?: {
        name?: string | null;
        phone?: string | null;
      } | null;
    } | null;
    payroll?: {
      clearanceTier?: string;
      baseSalary?: string | number | null;
      bankName?: string | null;
      bankAccount?: string | null;
    } | null;
  }) {
    const { account, demographics, placement, compliance, payroll } = payload;
    const roleUpper = (account.role || "STAFF").toUpperCase();
    const isDriver = roleUpper === "DRIVER";

    // Normalize optional buckets so capStringFields never crashes
    const demo = demographics || {};
    const place = placement || {};
    const pay = payroll || {};
    const comp = compliance || {};

    // 2026-09 "no small letters" rule: entered text is stored in capitals.
    // Emails are excluded — they are matched case-sensitively for logins.
    capStringFields(account, ['fullName']);
    if (demo) capStringFields(demo as Record<string, unknown>, ['gender', 'residentialAddress', 'bloodType', 'religion', 'formerSchool']);
    if (place) capStringFields(place as Record<string, unknown>, ['jobTitle', 'employmentType', 'shiftSchedule']);
    if (comp) {
      capStringFields(comp as Record<string, unknown>, ['nationalId', 'ssnitNumber']);
      const ec = (comp as { emergencyContact?: Record<string, unknown> | null }).emergencyContact;
      if (ec) capStringFields(ec as Record<string, unknown>, ['name']);
    }
    if (pay) capStringFields(pay as Record<string, unknown>, ['clearanceTier', 'bankName', 'bankAccount']);

    // Defaults — driver gets transport-flavoured defaults, others get generic
    const defaultDob = new Date('1990-01-01');
    const safeDob = (() => {
      const raw = (demo as { dateOfBirth?: string }).dateOfBirth;
      if (!raw) return defaultDob;
      const d = new Date(raw);
      return isNaN(d.getTime()) ? defaultDob : d;
    })();

    const safeGender = (demo as { gender?: string }).gender?.trim() || (isDriver ? 'MALE' : 'OTHER');
    const safeAddress = (demo as { residentialAddress?: string }).residentialAddress?.trim() || 'Not provided';
    const safePhone = (demo as { phone?: string }).phone?.trim() || '0000000000';

    const safeDeptId = (place as { departmentId?: string }).departmentId?.trim() || (isDriver ? 'TRANSPORT' : 'OPERATIONS');
    const safeJobTitle = (place as { jobTitle?: string }).jobTitle?.trim() || (isDriver ? 'Bus Driver' : 'General Staff');
    const safeEmpType = (place as { employmentType?: string }).employmentType?.trim() || 'FULL_TIME';
    const safeShift = (place as { shiftSchedule?: string }).shiftSchedule?.trim() || (isDriver ? 'MORNING' : 'Standard Shift');

    const safeClearance = (pay as { clearanceTier?: string }).clearanceTier?.trim() || 'clear-std';
    const rawSalary = (pay as { baseSalary?: string | number | null }).baseSalary;
    const safeBaseSalary = rawSalary !== undefined && rawSalary !== null && String(rawSalary).trim() !== '' ? parseFloat(String(rawSalary)) || 0 : 0;

    const safeBankName = (pay as { bankName?: string | null }).bankName?.trim() || null;
    const safeBankAccount = (pay as { bankAccount?: string | null }).bankAccount?.trim() || null;

    const safeAppointmentDate = (() => {
      const raw = account.employmentDate;
      if (!raw) return new Date();
      const d = new Date(raw);
      return isNaN(d.getTime()) ? new Date() : d;
    })();

    const deptPrefix = safeDeptId ? safeDeptId.replace(/^dept-/i, '').toUpperCase().slice(0, 8) : 'STF';
    const generatedStaffId = formatInstitutionalId('STF', deptPrefix || 'STF');

    return await prisma.$transaction(async (tx) => {
      const hashedPassword = await hashPassword(account.password);

      const completeDbPayload: Prisma.StaffCreateInput = {
        staffId: generatedStaffId,
        staffName: account.fullName,
        appointmentDate: safeAppointmentDate,
        status: EntityStatus.ACTIVE,

        account: {
          create: {
            email: account.email,
            passwordHash: hashedPassword,
            role: roleUpper,
          },
        },

        demographics: {
          create: {
            dateOfBirth: safeDob,
            gender: safeGender,
            residentialAddress: safeAddress,
            phone: safePhone,
            bloodType: (demo as { bloodType?: string | null }).bloodType || null,
            religion: (demo as { religion?: string | null }).religion || null,
            formerSchool: (demo as { formerSchool?: string | null }).formerSchool || null,
          },
        },

        placement: {
          create: {
            departmentId: safeDeptId,
            jobTitle: safeJobTitle,
            employmentType: safeEmpType,
            shiftSchedule: safeShift,
          },
        },

        compliance: {
          create: {
            nationalId: (comp as { nationalId?: string | null }).nationalId || null,
            ssnitNumber: (comp as { ssnitNumber?: string | null }).ssnitNumber || null,
            emergencyName: (comp as { emergencyContact?: { name?: string | null } | null }).emergencyContact?.name || null,
            emergencyPhone: (comp as { emergencyContact?: { phone?: string | null } | null }).emergencyContact?.phone || null,
          },
        },

        payroll: {
          create: {
            clearanceTier: safeClearance,
            baseSalary: safeBaseSalary,
            deductions: 0,
            netPay: safeBaseSalary,
            bankName: safeBankName,
            bankAccount: safeBankAccount,
            salaryStatus: 'PENDING',
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

    // 2026-09 "no small letters" rule (see createStaff).
    capStringFields(data, ['staffName']);
    if (data.demographics) capStringFields(data.demographics as Record<string, unknown>, ['gender', 'residentialAddress', 'bloodType', 'religion', 'formerSchool']);
    if (data.placement) capStringFields(data.placement as Record<string, unknown>, ['jobTitle', 'employmentType', 'shiftSchedule']);
    if (data.compliance) capStringFields(data.compliance as Record<string, unknown>, ['nationalId', 'ssnitNumber', 'emergencyName']);
    if (data.payroll) capStringFields(data.payroll as Record<string, unknown>, ['clearanceTier', 'paymentRoute', 'bankName', 'bankAccount']);

    return this.repo.update(id, data);
  }

}
