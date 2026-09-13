import { prisma } from "@/lib/prisma";
import { AppError } from "@/middleware/error.handler";
import type { Prisma } from "@prisma/client";
import type { DataWipeInput, InstitutionUpdateInput } from "./admin.validation";

export type WipeScope = DataWipeInput["scope"];

interface WipeCounts {
  [table: string]: number;
}

export interface DataSummary {
  students: number;
  guardians: number;
  attendanceRecords: number;
  gradeRecords: number;
  teachers: number;
  staff: number;
  payrollRows: number;
  classes: number;
  subjects: number;
  terms: number;
  invoices: number;
  payments: number;
  paymentCollections: number;
  paymentIntents: number;
  expenses: number;
  feeStructures: number;
  feeTiers: number;
  feeComponents: number;
  announcements: number;
  auditLogs: number;
}

const PRESERVED_ON_WIPE = [
  "Institution profile (Settings → Institution)",
  "Class, subject and term structure",
  "Timetable structure (class/subject slots — teacher links cleared only for wiped teachers)",
  "Chart of accounts",
  "Admin accounts (you cannot wipe your own access)",
  "Audit trail",
];

/**
 * Admin / institutional maintenance module.
 *
 * Wipes run in ONE database transaction per call, in FK-safe order:
 *  - the only Restrict edge into `student` is `paymentIntent.studentId`, so
 *    payment intents are removed before students; everything else cascades.
 *  - staff/teacher references are all Cascade; only SubjectAllocation stores a
 *    plain `teacherId` string and is cleaned explicitly.
 *  - admin-role accounts are always preserved so the school can still log in.
 */
export class AdminService {
  async getInstitution() {
    const config = await prisma.systemConfig.findUnique({ where: { id: 1 } });
    if (!config) throw new AppError(500, "Institution record is missing. Re-run setup.");
    return config;
  }

  async updateInstitution(input: InstitutionUpdateInput) {
    const config = await prisma.systemConfig.findUnique({ where: { id: 1 } });
    if (!config) throw new AppError(500, "Institution record is missing. Re-run setup.");

    // Guard: schoolCode is the wipe confirmation token — keep it stable enough
    // that a half-typed save cannot silently change the confirmation ritual.
    if (input.schoolCode && input.schoolCode !== config.schoolCode) {
      // Intentionally allowed; the Settings UI explains the consequence.
    }

    return prisma.systemConfig.update({ where: { id: 1 }, data: input });
  }

  async getDataSummary(): Promise<DataSummary> {
    const [
      students,
      guardians,
      attendanceRecords,
      gradeRecords,
      teachers,
      staff,
      staffPayrolls,
      teacherPayrolls,
      classes,
      subjects,
      terms,
      invoices,
      payments,
      paymentCollections,
      paymentIntents,
      expenses,
      feeStructures,
      feeTiers,
      feeComponents,
      announcements,
      auditLogs,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.guardian.count(),
      prisma.attendanceRecord.count(),
      prisma.gradeRecord.count(),
      prisma.teacher.count(),
      prisma.staff.count(),
      prisma.staffPayroll.count(),
      prisma.teacherPayroll.count(),
      prisma.class.count(),
      prisma.subject.count(),
      prisma.term.count(),
      prisma.invoice.count(),
      prisma.payment.count(),
      prisma.paymentCollection.count(),
      prisma.paymentIntent.count(),
      prisma.expense.count(),
      prisma.feeStructureConfiguration.count(),
      prisma.feeTier.count(),
      prisma.feeComponent.count(),
      prisma.announcement.count(),
      prisma.auditLog.count(),
    ]);

    return {
      students,
      guardians,
      attendanceRecords,
      gradeRecords,
      teachers,
      staff,
      payrollRows: staffPayrolls + teacherPayrolls,
      classes,
      subjects,
      terms,
      invoices,
      payments,
      paymentCollections,
      paymentIntents,
      expenses,
      feeStructures,
      feeTiers,
      feeComponents,
      announcements,
      auditLogs,
    };
  }

  async wipeData(input: DataWipeInput, actor: { id: string; email: string; role: string }) {
    const config = await this.getInstitution();

    if (input.confirm !== config.schoolCode) {
      throw new AppError(400, "Confirmation mismatch — type the school code exactly to wipe.");
    }

    const counts: WipeCounts = {};
    const scope = input.scope;

    await prisma.$transaction(
      async (tx) => {
        if (scope === "students" || scope === "all") {
          await this.wipeStudents(tx, counts);
        }
        if (scope === "personnel" || scope === "all") {
          await this.wipePersonnel(tx, counts);
        }
        if (scope === "financial" || scope === "all") {
          await this.wipeFinancial(tx, counts);
        }
        if (scope === "all") {
          counts.announcements = (await tx.announcement.deleteMany()).count;
          counts.notificationDeliveries = (await tx.notificationDelivery.deleteMany()).count;
          counts.refreshTokens = (await tx.refreshToken.deleteMany()).count;
        }

        await tx.auditLog.create({
          data: {
            requestId: `wipe-${Date.now()}`,
            actorId: actor.id,
            actorEmail: actor.email,
            actorRole: actor.role,
            action: "DATA_WIPE",
            method: "POST",
            path: "/api/admin/data/wipe",
            requestBody: { scope, counts } as Prisma.InputJsonValue,
            responseStatus: 200,
            ipAddress: "server",
          },
        });
      },
      { timeout: 120_000, maxWait: 5_000 }
    );

    return {
      scope,
      counts,
      preserved: PRESERVED_ON_WIPE,
      message:
        scope === "all"
          ? "Full data reset complete. Admin accounts, structure and the audit trail were preserved."
          : `Wiped ${scope} data. Structure and admin accounts were preserved.`,
    };
  }

  async getAuditLog(limit = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    return prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: safeLimit,
    });
  }

  // ── zone wipes (called inside the wipe transaction) ────────────────────────

  private async wipeStudents(tx: Prisma.TransactionClient, counts: WipeCounts) {
    counts.guardiansBefore = await tx.guardian.count();
    // Restrict edge first, then everything else cascades from the student row.
    counts.paymentIntents = (await tx.paymentIntent.deleteMany()).count;
    counts.paymentCollections = (await tx.paymentCollection.deleteMany()).count;
    counts.payments = (await tx.payment.deleteMany()).count;
    counts.paymentWebhookEvents = (await tx.paymentWebhookEvent.deleteMany()).count;
    counts.attendanceRecords = (await tx.attendanceRecord.deleteMany()).count;
    counts.gradeRecords = (await tx.gradeRecord.deleteMany()).count;
    counts.studentDepartures = (await tx.studentDeparture.deleteMany()).count;
    counts.students = (await tx.student.deleteMany()).count;
  }

  private async wipePersonnel(tx: Prisma.TransactionClient, counts: WipeCounts) {
    const [adminStaff, adminTeachers] = await Promise.all([
      tx.staffAccount.findMany({ where: { role: "ADMIN" }, select: { staffId: true } }),
      tx.teacherAccount.findMany({ where: { role: "ADMIN" }, select: { teacherId: true } }),
    ]);
    const protectedStaffIds = adminStaff.map((row) => row.staffId);
    const protectedTeacherIds = adminTeachers.map((row) => row.teacherId);

    const removableTeachers = await tx.teacher.findMany({
      where: { id: { notIn: protectedTeacherIds } },
      select: { id: true },
    });

    // SubjectAllocation stores a plain teacherId string (no FK) — clean it
    // before the teacher rows disappear so no dangling references remain.
    counts.subjectAllocations = (
      await tx.subjectAllocation.deleteMany({
        where: { teacherId: { in: removableTeachers.map((row) => row.id) } },
      })
    ).count;

    counts.teachers = (
      await tx.teacher.deleteMany({ where: { id: { notIn: protectedTeacherIds } } })
    ).count;
    counts.staff = (
      await tx.staff.deleteMany({ where: { id: { notIn: protectedStaffIds } } })
    ).count;
    counts.preservedAdminAccounts = protectedStaffIds.length + protectedTeacherIds.length;
  }

  private async wipeFinancial(tx: Prisma.TransactionClient, counts: WipeCounts) {
    counts.feeComponents = (await tx.feeComponent.deleteMany()).count;
    counts.feeStructures = (await tx.feeStructureConfiguration.deleteMany()).count;
    counts.feeTiers = (await tx.feeTier.deleteMany()).count;
    counts.paymentCollections = (await tx.paymentCollection.deleteMany()).count;
    counts.paymentIntents = (await tx.paymentIntent.deleteMany()).count;
    counts.paymentWebhookEvents = (await tx.paymentWebhookEvent.deleteMany()).count;
    counts.payments = (await tx.payment.deleteMany()).count;
    counts.invoices = (await tx.invoice.deleteMany()).count;
    counts.expenses = (await tx.expense.deleteMany()).count;
    counts.teacherPayrolls = (await tx.teacherPayroll.deleteMany()).count;
    counts.staffPayrolls = (await tx.staffPayroll.deleteMany()).count;
    // Ledger accounts are structure (chart of accounts) — zero balances, keep rows.
    counts.billingLedgersZeroed = (
      await tx.billingLedger.updateMany({
        where: {},
        data: { currentBalance: 0, initialDeposit: 0 },
      })
    ).count;
  }
}
