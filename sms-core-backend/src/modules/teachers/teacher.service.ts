import crypto from 'crypto';
import { prisma } from "@/lib/prisma";
import { EntityStatus, ClearanceStatus, PersonnelDepartureType, Prisma } from "@prisma/client";
import { ITeacherRepository } from "@/types/repositories";
import { TeacherRepository } from "./teacher.repository";
import { formatInstitutionalId } from "@/utils";
import { hashPassword } from "@/utils/hash";

type TeacherWithRelations = Prisma.TeacherGetPayload<{
  include: {
    demographics: true;
    compliance: true;
    payroll: true;
  };
}>;

export class TeacherService {
  constructor(private repo: ITeacherRepository = new TeacherRepository()) {}

  private mapTeacher(teacher: TeacherWithRelations) {
    return {
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
        academicTrack: teacher.subject || "Unassigned",
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
        baseSalary: teacher.payroll?.baseSalary
          ? Number(teacher.payroll.baseSalary)
          : 0.0,
        deductions: teacher.payroll?.deductions
          ? Number(teacher.payroll.deductions)
          : 0.0,
        netPay: teacher.payroll?.netPay
          ? Number(teacher.payroll.netPay)
          : 0.0,
        paymentRoute: "BANK_TRANSFER",
        bankName: teacher.payroll?.bankName ?? "Unconfigured Bank",
        bankAccount: teacher.payroll?.bankAccount ?? "—",
        salaryStatus: teacher.payroll?.salaryStatus ?? "PENDING",
      },
    };
  }

  async getAllTeachers() {
    const rawTeachers = await this.repo.findAllActive();
    return rawTeachers.map((teacher: TeacherWithRelations) => this.mapTeacher(teacher));
  }

  async getPaginatedTeachers(skip: number, take: number) {
    const [rawTeachers, total] = await Promise.all([
      this.repo.findAllActive(skip, take),
      this.repo.countActive(),
    ]);
    return {
      data: (rawTeachers as TeacherWithRelations[]).map((t) => this.mapTeacher(t)),
      total,
    };
  }

  async createTeacher(payload: {
    account: {
      fullName: string;
      email: string;
      password?: string;
    };
    placement?: {
      departmentId?: string;
      jobTitle?: string;
      employmentType?: string;
    };
    demographics: {
      gender: string;
      dateOfBirth: string;
      phone: string;
      residentialAddress: string;
      bloodType?: string;
      religion?: string;
      formerSchool?: string;
    };
  }) {
    const { account, placement, demographics } = payload;

    // ── P0-2 fix: refuse to fabricate PII ──
    // All demographic fields must be provided by the caller.
    // The validation schema should enforce this at the route level
    // (Phase 3, Task 3.1), but we guard here as a safety net so
    // no code path can ever inject fake data into the database.
    const requiredDemographicFields = ['gender', 'dateOfBirth', 'phone', 'residentialAddress'] as const;
    for (const field of requiredDemographicFields) {
      if (!demographics || !demographics[field]) {
        throw new Error(
          `Missing required demographic field: ${field}. ` +
          `Teacher creation requires complete demographic information — ` +
          `fabricated PII is not permitted.`
        );
      }
    }

    const deptPrefix = placement?.departmentId
      ? placement.departmentId.replace("dept-", "").toUpperCase()
      : "TCH";

    const uniqueTeacherId = formatInstitutionalId("TCH", deptPrefix);

    // Generate a temporary password if not provided by the caller.
    // Returned in the response so the admin can communicate it to
    // the teacher. A proper email delivery flow is planned for
    // Phase 4 (Task 4.1).
    const rawPassword = account.password || crypto.randomBytes(16).toString('base64url');

    const result = await prisma.$transaction(async (tx) => {
      const hashedPassword = await hashPassword(rawPassword);

      const completeDbPayload: Prisma.TeacherCreateInput = {
        teacherId: uniqueTeacherId,
        teacherName: account.fullName,
        email: account.email,
        department: placement?.departmentId || "ACADEMICS",
        subject: placement?.jobTitle || "General Subject",
        employmentType: placement?.employmentType || "Full-Time",
        status: EntityStatus.ACTIVE,
        yearsOfExperience: 0,

        demographics: {
          create: {
            gender: demographics.gender,
            residentialAddress: demographics.residentialAddress,
            dateOfBirth: new Date(demographics.dateOfBirth),
            phone: demographics.phone,
            bloodType: demographics.bloodType || null,
            religion: demographics.religion || null,
            formerSchool: demographics.formerSchool || null,
          },
        },

        compliance: {
          create: {},
        },

        payroll: {
          create: {
            clearanceTier: "Level 1: Standard Faculty Access",
            baseSalary: 0.0,
            deductions: 0.0,
            netPay: 0.0,
            bankName: "Unconfigured Bank",
            bankAccount: "—",
            salaryStatus: "PENDING",
          },
        },
      };

      const newTeacher = await this.repo.createNestedTeacher(
        completeDbPayload,
        tx
      );

      await tx.teacherAccount.create({
        data: {
          teacherId: newTeacher.id,
          email: account.email,
          passwordHash: hashedPassword,
          role: "FACULTY",
        },
      });

      return newTeacher;
    });

    // Return the teacher record with the temporary password attached.
    // Underscore prefix signals internal fields to API consumers.
    // The controller should pass these through to the admin response.
    // Phase 4 will replace this with email-based password delivery.
    return {
      ...result,
      _temporaryPassword: rawPassword,
      _warning: "Communicate this password to the teacher immediately. Email delivery not yet implemented.",
    };
  }

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
    const { teacherId, departureType, effectiveDate, clearance, remarks } =
      payload;

    return await prisma.$transaction(async (tx) => {
      const teacherRecord = await this.repo.findByPublicId(teacherId, tx);

      if (!teacherRecord) {
        throw new Error(
          `Target faculty lookup failed. No active record found for ID: ${teacherId}`
        );
      }

      if (teacherRecord.status === EntityStatus.DEPARTED) {
        throw new Error(
          `System conflict: Teacher ${teacherId} already departed.`
        );
      }

      const departureLog = await this.repo.createDepartureLog(
        {
          teacherInternalId: teacherRecord.id,
          departureType: departureType as PersonnelDepartureType,
          effectiveDate: new Date(effectiveDate),
          academicClearanceStatus: clearance.academic as ClearanceStatus,
          treasuryClearanceStatus: clearance.treasury as ClearanceStatus,
          remarks,
        },
        tx
      );

      await this.repo.updateStatus(
        teacherRecord.id,
        EntityStatus.DEPARTED,
        tx
      );

      return departureLog;
    });
  }

  // TODO: P1-4 — Phase 3 Task 3.2: Replace `any` types with proper interfaces
  async update(id: string, payload: any) {
    const teacher = await this.repo.findById(id);
    if (!teacher) throw new Error(`Teacher not found with ID: ${id}`);
    if (teacher.status === 'DEPARTED') throw new Error('Cannot update a departed teacher.');

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
