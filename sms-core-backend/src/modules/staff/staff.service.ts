import { prisma } from "@/lib/prisma";
import { PersonnelDepartureType } from "@prisma/client";
import { formatInstitutionalId } from "@/utils";
import { hashPassword } from "@/utils/hash";      

export class StaffService {
  /**
   * Queries all ACTIVE database staff rows ordered by creation context.
   * Automatically excludes departed staff from active operational views.
   */
  async getAllStaff() {
    return await prisma.staff.findMany({
      where: {
        status: { not: "DEPARTED" }
      },
      include: {
        account: true,
        demographics: true,
        placement: true,
        compliance: true,
        payroll: true,
      },
      orderBy: {
        id: "desc",
      },
    });
  } 

  /**
   * Workforce Placement & Shift Allocation
   * Compiles high-density operational data tracking departments, titles, and shift rosters.
   */
  async getWorkforceMatrix() {
    const staffMembers = await prisma.staff.findMany({
      where: {
        status: { not: "DEPARTED" }
      },
      include: {
        account: true,
        placement: true,
      },
      orderBy: {
        appointmentDate: "desc"
      }
    });

    return staffMembers.map((member) => ({
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
   * Generates the institutional ID and executes the Prisma transaction.
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

    // Generate a unique institutional staff identifier string
    const deptPrefix = placement.departmentId ? placement.departmentId.replace("dept-", "").toUpperCase() : "STF";
const generatedStaffId = formatInstitutionalId('STF', deptPrefix);
    // Execute atomic nested Prisma transaction
    const staff = await prisma.$transaction(async (tx) => {
       const hashedPassword = await hashPassword(account.password);

      return await tx.staff.create({
        data: {
          staffId: generatedStaffId,
          staffName: account.fullName,
          appointmentDate: new Date(account.employmentDate),
          status: "ACTIVE",

          account: {
            create: {
              email: account.email,
              passwordHash: account.password,
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
        },
      });
    });

    // Return exactly what the controller (and frontend) expects
    return {
      id: staff.id,
      staffId: staff.staffId,
      staffName: staff.staffName,
    };
  }

  /**
   * Processes the atomic offboarding of a staff member.
   * Resolves the public ID, creates an immutable audit log, and deactivates the account.
   */
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

    // 1. Resolve the public-facing staffId to the internal database UUID
    const staffRecord = await prisma.staff.findUnique({
      where: { staffId: staffId },
    });

    if (!staffRecord) {
      throw new Error(`Target staff lookup failed. No active record found for ID: ${staffId}`);
    }

    if (staffRecord.status === "DEPARTED") {
      throw new Error(`System conflict: Staff member ${staffId} has already been processed for departure.`);
    }

    // 2. Execute an atomic transaction
    return await prisma.$transaction(async (tx) => {
      // A. Create the immutable audit departure log
      const departureLog = await tx.staffDeparture.create({
        data: {
          staffInternalId: staffRecord.id,
          departureType: departureType as PersonnelDepartureType,
          effectiveDate: new Date(effectiveDate),
          hrClearanceStatus: clearance.hr,
          itAssetReturnStatus: clearance.itAssets,
          treasuryClearanceStatus: clearance.treasury,
          remarks,
        },
      });

      // B. Update the core staff status
      await tx.staff.update({
        where: { id: staffRecord.id },
        data: { status: "DEPARTED" },
      });

      return departureLog;
    });
  }
}