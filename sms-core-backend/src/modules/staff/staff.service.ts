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
    const [rawStaff, total] = await Promise.all([
      this.repo.findAllActive(skip, take),
      this.repo.countActive(),
    ]);
    return {
      data: (rawStaff as StaffWithRelations[]).map((s) => this.mapStaff(s)),
      total,
    };
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
        throw new Error(`Target staff lookup failed. No active record found for ID: ${staffId}`);
      }

      if (staffRecord.status === EntityStatus.DEPARTED) {
        throw new Error(`System conflict: Staff member ${staffId} has already been processed for departure.`);
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

  async update(id: string, payload: any) {
    const staff = await this.repo.findById(id);
    if (!staff) throw new Error(`Staff member not found with ID: ${id}`);
    if (staff.status === 'DEPARTED') throw new Error('Cannot update a departed staff member.');

    const data: any = { ...payload };
    if (data.demographics?.dateOfBirth) {
      data.demographics.dateOfBirth = new Date(data.demographics.dateOfBirth);
    }
    if (data.payroll) {
      if (data.payroll.baseSalary !== undefined) data.payroll.baseSalary = parseFloat(String(data.payroll.baseSalary)) || 0;
      if (data.payroll.deductions !== undefined) data.payroll.deductions = parseFloat(String(data.payroll.deductions)) || 0;
      if (data.payroll.netPay !== undefined) data.payroll.netPay = parseFloat(String(data.payroll.netPay)) || 0;
    }

    return this.repo.update(id, data);
  }

}
