import { prisma } from "@/lib/prisma";
import { PersonnelDepartureType } from "@prisma/client";
import { formatInstitutionalId } from "@/utils";
import { TeacherRepository } from "./teacher.repository"; // NEW

export class TeacherService {
  private repo = new TeacherRepository(); // NEW

  /**
   * Retrieves all ACTIVE teacher entries including their relational data
   * and maps them to match frontend expectations.
   * 
   * NOTE: The frontend expects a uniform shape across Students/Staff/Teachers,
   * so we reshape the flat Teacher table into nested account/placement objects.
   */
  async getAllTeachers() {
    // ✅ Delegated to repo
    const rawTeachers = await this.repo.findAllActive();

    // Map the database rows to match the object shapes your frontend tables expect
    return rawTeachers.map((teacher: any) => ({
      ...teacher,
      // Map properties to match the account sub-object
      account: {
        fullName: teacher.teacherName,
        email: teacher.email,
        role: "FACULTY",
      },
      // Map properties to match the placement sub-object
      placement: {
        departmentId: teacher.department,
        jobTitle: teacher.subject,
        employmentType: teacher.employmentType,
        academicTrack: "General Arts", // Fallback default value for UI filtering
      },
      // Map properties to match the demographics sub-object
      demographics: {
        phone: teacher.demographics?.phone ?? null,
        formerSchool: teacher.demographics?.formerSchool ?? null,
        gender: teacher.demographics?.gender ?? null,
        dateOfBirth: teacher.demographics?.dateOfBirth ?? null,
        bloodType: teacher.demographics?.bloodType ?? null,
        religion: teacher.demographics?.religion ?? null,
        residentialAddress: teacher.demographics?.residentialAddress ?? null,
      },
      // Map properties to match the compliance sub-object
      compliance: {
        nationalId: teacher.compliance?.nationalId ?? null,
        ssnitNumber: teacher.compliance?.ssnitNumber ?? null,
        emergencyName: teacher.compliance?.emergencyName ?? null,
        emergencyPhone: teacher.compliance?.emergencyPhone ?? null,
      },
      // Map properties to match the payroll sub-object
      payroll: {
        baseSalary: teacher.payroll?.baseSalary ?? 0.00,
        deductions: teacher.payroll?.deductions ?? 0.00,
        netPay: teacher.payroll?.netPay ?? 0.00,
        paymentRoute: teacher.payroll?.paymentRoute ?? "BANK_TRANSFER",
        bankName: teacher.payroll?.bankName ?? "Unconfigured Bank",
        bankAccount: teacher.payroll?.bankAccount ?? "—",
        salaryStatus: teacher.payroll?.salaryStatus ?? "PENDING",
      }
    }));
  }

  /**
   * Generates the institutional ID, normalizes the frontend payload 
   * to match the flat Prisma schema, and commits it.
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

    // Generate a clean institutional ID based on the incoming department block
    const deptPrefix = placement?.departmentId ? placement.departmentId.replace("dept-", "").toUpperCase() : "TCH";
    const uniqueTeacherId = formatInstitutionalId('TCH', deptPrefix);
    
    // Map incoming UI data structures to match the flat schema.prisma fields exactly
    const databasePayload = {
      teacherId: uniqueTeacherId,
      teacherName: account.fullName,
      email: account.email,
      department: placement?.departmentId || "ACADEMICS",
      subject: placement?.jobTitle || "General Subject",
      employmentType: placement?.employmentType || "Full-Time",
      status: "ACTIVE" as const, // Cast to exact Prisma EntityStatus enum
      yearsOfExperience: 0 // Default starting value
    };

    // ✅ Delegated to repo
    return this.repo.createTeacher(databasePayload);
  }

  /**
   * Processes the atomic offboarding of a faculty member.
   * Resolves the public ID, creates an immutable audit log, and deactivates the account.
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

    // ✅ Delegated to repo
    const teacherRecord = await this.repo.findByPublicId(teacherId);

    if (!teacherRecord) {
      throw new Error(`Target faculty lookup failed. No active record found for ID: ${teacherId}`);
    }

    if (teacherRecord.status === "DEPARTED") {
      throw new Error(`System conflict: Teacher ${teacherId} has already been processed for departure.`);
    }

    // 2. Execute an atomic transaction
    return await prisma.$transaction(async (tx) => {
      // ✅ Delegated to repo, passing tx
      const departureLog = await this.repo.createDepartureLog({
        teacherInternalId: teacherRecord.id,
        departureType: departureType as PersonnelDepartureType,
        effectiveDate: new Date(effectiveDate),
        academicClearanceStatus: clearance.academic,
        treasuryClearanceStatus: clearance.treasury,
        remarks,
      }, tx);

      // ✅ Delegated to repo, passing tx
      await this.repo.updateStatus(teacherRecord.id, "DEPARTED", tx);

      return departureLog;
    });
  }
}