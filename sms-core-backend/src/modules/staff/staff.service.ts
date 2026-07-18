import { AppError } from '@/middleware/error.handler';
import { prisma } from "@/lib/prisma";
import { PersonnelDepartureType, EntityStatus, ClearanceStatus, Prisma } from "@prisma/client";
import { IStaffRepository } from "@/types/repositories";
import { StaffRepository } from "./staff.repository";
import { formatInstitutionalId } from "@/utils";
import { hashPassword } from "@/utils/hash";

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
      if (pay.netPay !== undefined) pay.netPay = parseFloat(String(pay.netPay)) || 0;
    }

    return this.repo.update(id, data);
  }

}
