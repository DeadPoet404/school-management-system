import { prisma } from "@/lib/prisma";
import { PersonnelDepartureType, EntityStatus, Prisma } from "@prisma/client";
import { formatInstitutionalId } from "@/utils";
import { hashPassword } from "@/utils/hash";      
import { StaffRepository } from "./staff.repository";

// FIX: Align the type definition to match the complete sub-tables fetched by the repository
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
  private repo = new StaffRepository();

  /**
   * Queries all ACTIVE database staff rows ordered by creation context.
   * Maps fields securely to conform to UI frontend data-grid expectations.
   */
  async getAllStaff() {
    // The repository returns the full object arrays, which now match the mapped parameter exactly
    const rawStaff = await this.repo.findAllActive();

    return (rawStaff as StaffWithRelations[]).map((staff: StaffWithRelations) => ({
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
    }));
  } 

  /**
   * Workforce Placement & Shift Allocation
   * Compiles high-density operational data tracking departments, titles, and shift rosters.
   */
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

  /**
   * Commits an atomic staff registration payload into nested core transactional tables.
   * Generates the institutional ID and executes the repo creation routine.
   */
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

  /**
   * Processes the atomic offboarding of a staff member.
   * Resolves the public ID, creates an immutable audit log, and deactivates the account.
   */
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
        hrClearanceStatus: clearance.hr,
        itAssetReturnStatus: clearance.itAssets,
        treasuryClearanceStatus: clearance.treasury,
        remarks,
      }, tx);

      await this.repo.updateStatus(staffRecord.id, EntityStatus.DEPARTED, tx);

      return departureLog;
    });
  }
} 