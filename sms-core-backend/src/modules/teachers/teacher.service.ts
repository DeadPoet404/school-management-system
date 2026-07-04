import { prisma } from "@/lib/prisma";
import { PersonnelDepartureType, EntityStatus, Prisma } from "@prisma/client";
import { formatInstitutionalId } from "@/utils";
import { TeacherRepository } from "./teacher.repository";

// Extract structural runtime typing maps from the matching Repository graph layout
type TeacherWithRelations = Prisma.TeacherGetPayload<{
  include: {
    demographics: true;
    compliance: true;
    payroll: true;
  };
}>;

export class TeacherService {
  private repo = new TeacherRepository();

  /**
   * Retrieves all ACTIVE teacher entries including their relational data
   * and maps them to match frontend expectations.
   * * SAFE: Preserves exact field paths so UI data-grid components do not break.
   */
  async getAllTeachers() {
    const rawTeachers = await this.repo.findAllActive();

    return rawTeachers.map((teacher: TeacherWithRelations) => ({
      ...teacher,
      account: {
        fullName: teacher.teacherName,
        email: teacher.email,
        role: "FACULTY",
      },
      placement: {
        departmentId: teacher.department,
        jobTitle: teacher.subject,
        employmentType: teacher.employmentType,
        academicTrack: "General Arts",
      },
      demographics: {
        phone: teacher.demographics?.phone ?? null,
        formerSchool: teacher.demographics?.formerSchool ?? null,
        gender: teacher.demographics?.gender ?? null,
        dateOfBirth: teacher.demographics?.dateOfBirth ?? null,
        bloodType: teacher.demographics?.bloodType ?? null,
        religion: teacher.demographics?.religion ?? null,
        residentialAddress: teacher.demographics?.residentialAddress ?? null,
      },
      compliance: {
        nationalId: teacher.compliance?.nationalId ?? null,
        ssnitNumber: teacher.compliance?.ssnitNumber ?? null,
        emergencyName: teacher.compliance?.emergencyName ?? null,
        emergencyPhone: teacher.compliance?.emergencyPhone ?? null,
      },
      payroll: {
        baseSalary: teacher.payroll?.baseSalary ? Number(teacher.payroll.baseSalary) : 0.00,
        deductions: teacher.payroll?.deductions ? Number(teacher.payroll.deductions) : 0.00,
        netPay: teacher.payroll?.netPay ? Number(teacher.payroll.netPay) : 0.00,
        paymentRoute: "BANK_TRANSFER",
        bankName: teacher.payroll?.bankName ?? "Unconfigured Bank",
        bankAccount: teacher.payroll?.bankAccount ?? "—",
        salaryStatus: teacher.payroll?.salaryStatus ?? "PENDING",
      }
    }));
  }

  /**
   * Generates institutional credentials and cleanly instantiates the complete relational cluster.
   * * FIXED: Seed blocks are fully structured to fulfill strict schema typing obligations.
   */
  async createTeacher(payload: {
    account: {
      fullName: string;
      email: string;
    };
    placement?: {
      departmentId?: string;
      jobTitle?: string;
      employmentType?: string;
    };
  }) {
    const { account, placement } = payload;

    const deptPrefix = placement?.departmentId ? placement.departmentId.replace("dept-", "").toUpperCase() : "TCH";
    const uniqueTeacherId = formatInstitutionalId('TCH', deptPrefix);
    
    const completeDbPayload: Prisma.TeacherCreateInput = {
      teacherId: uniqueTeacherId,
      teacherName: account.fullName,
      email: account.email,
      department: placement?.departmentId || "ACADEMICS",
      subject: placement?.jobTitle || "General Subject",
      employmentType: placement?.employmentType || "Full-Time",
      status: EntityStatus.ACTIVE,
      yearsOfExperience: 0,
      
      // FIX: Added 'dateOfBirth' and 'phone' placeholders to pass schema constraints safely
      demographics: {
        create: {
          gender: "UNSPECIFIED",
          residentialAddress: "Not Provided",
          dateOfBirth: new Date("2000-01-01"),
          phone: "+233000000000"
        }
      },
      compliance: {
        create: {}
      },
      payroll: {
        create: {
          clearanceTier: "Level 1: Standard Faculty Access", 
          baseSalary: 0.00,
          deductions: 0.00,
          netPay: 0.00,
          bankName: "Unconfigured Bank",
          bankAccount: "—",
          salaryStatus: "PENDING"
        }
      }
    };

    return this.repo.createNestedTeacher(completeDbPayload);
  }
  /**
   * Processes the atomic offboarding of a faculty member.
   * * FIXED: Relational log mappings match required clearance indicators.
   */
  async processDeparture(payload: {
    teacherId: string;
    departureType: string;
    effectiveDate: string;
    clearance: {
      academic: string;
      treasury: string;
    };
    remarks: string;
  }) {
    const { teacherId, departureType, effectiveDate, clearance, remarks } = payload;

    return await prisma.$transaction(async (tx) => {
      const teacherRecord = await this.repo.findByPublicId(teacherId, tx);

      if (!teacherRecord) {
        throw new Error(`Target faculty lookup failed. No active record found for ID: ${teacherId}`);
      }

      if (teacherRecord.status === EntityStatus.DEPARTED) {
        throw new Error(`System conflict: Teacher ${teacherId} has already been processed for departure.`);
      }

      // FIX: Added 'academicClearanceStatus' and 'treasuryClearanceStatus' assignments directly
      const departureLog = await this.repo.createDepartureLog({
        teacherInternalId: teacherRecord.id,
        departureType: departureType as PersonnelDepartureType,
        effectiveDate: new Date(effectiveDate),
        academicClearanceStatus: clearance.academic, 
        treasuryClearanceStatus: clearance.treasury,   
        remarks,
      }, tx);

      await this.repo.updateStatus(teacherRecord.id, EntityStatus.DEPARTED, tx);

      return departureLog;
    });
  }
}