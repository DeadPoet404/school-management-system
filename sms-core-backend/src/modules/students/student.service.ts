import { prisma } from "@/lib/prisma";
import { StudentRepository } from "./student.repository";
import { formatInstitutionalId } from "@/utils";
import { hashPassword } from "@/utils/hash";
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
// ── TARIFF CONFIGURATION ──
// Maps frontend tier IDs to their base monetary values for ledger calculations.
const FEE_TARIFFS: Record<string, number> = {
  "tier-std": 2500, // Standard Tuition Rate
  "tier-aid": 1250, // Financial Aid Subsidized
  "tier-sch": 0,    // Full Scholarship
};

const calculateInitialBalance = (feeTierId: string, deposit: number): number => {
  const baseTariff = FEE_TARIFFS[feeTierId] ?? 0;
  return Math.max(0, baseTariff - deposit);
};

// ── INTERNAL TYPING FOR TRANSFORMATION ──
// Kept private to this service — frontend never sees these
interface InvoiceType {
  invoiceNo: string;
  amount: number;
  createdAt: Date;
}

interface PaymentType {
  receiptNo: string;
  amount: number;
  paymentType: string;
  createdAt: Date;
}

// ── SERVICE CLASS ──
export class StudentService {
  private repo = new StudentRepository();

  /**
   * Passthrough to fetch raw relational graph.
   * Keeps the exact Prisma shape the frontend tables expect.
   */
  async getAll() {
    return this.repo.findAll();
  }

  /**
   * Dynamic Ledger Matrix Compiler
   * Resolves, transforms, and cron-sorts global invoices vs collection receipts 
   * to calculate the exact chronological ledger snapshot for the frontend.
   */
  async getFinancialMatrix() {
    const students = await this.repo.findWithFinancialData();

    return students.map((student: any) => {
      const rawInvoices = (student.invoices || []) as InvoiceType[];
      const rawPayments = (student.payments || []) as PaymentType[];

      const invoiceLogs = rawInvoices.map((inv: InvoiceType) => ({
        id: inv.invoiceNo,
        date: inv.createdAt,
        type: "Invoice",
        amount: inv.amount,
      }));

      const paymentLogs = rawPayments.map((pay: PaymentType) => ({
        id: pay.receiptNo,
        date: pay.createdAt,
        type: pay.paymentType,
        amount: pay.amount,
      }));

      const sortedHistory = [...invoiceLogs, ...paymentLogs].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      let rollingOutstandingBalance = 0;
      sortedHistory.forEach((transaction) => {
        if (transaction.type === "Invoice") {
          rollingOutstandingBalance += transaction.amount;
        } else {
          rollingOutstandingBalance -= transaction.amount;
        }
      });

      const lastTx = sortedHistory[sortedHistory.length - 1];

      return {
        id: student.id,
        studentId: student.studentId,
        studentName: student.studentName,
        status: student.status,
        account: student.account,
        lastTransactionId: lastTx?.id || "—",
        lastTransactionDate: lastTx?.date || "—",
        paymentType: lastTx?.type || "—",
        amountPaid: lastTx && lastTx.type !== "Invoice" ? lastTx.amount : 0,
        balanceRemaining: rollingOutstandingBalance,
      };
    });
  }

  /**
   * Commits a complete student registration payload into the database.
   * Unpacks the nested frontend `compliance.emergencyContact` object into flat DB columns.
   */
  async createStudent(payload: {
    account: { fullName: string; email: string; password: string; enrollmentDate: string };
    demographics: { dateOfBirth: string; gender: string; residentialAddress: string; medicalNotes?: string | null; bloodType?: string | null; religion?: string | null; formerSchool?: string | null };
    placement: { classId: string; academicTrack: string; boardingStatus: string };
    guardian: { name: string; relationship: string; phone: string; email?: string | null };
    billing: { feeTierId: string; initialDeposit: number };
    compliance?: { nationalId?: string | null; emergencyContact?: { name?: string | null; phone?: string | null; relationship?: string | null } | null };
  }) {
    const { account, demographics, placement, guardian, billing, compliance } = payload;

    const uniqueStudentId = formatInstitutionalId('STU', '2026');
    const computedBalance = calculateInitialBalance(billing.feeTierId, billing.initialDeposit);

    // Service controls the transaction boundary, but passes 'tx' to the repository
    return await prisma.$transaction(async (tx) => {
      const hashedPassword = await hashPassword(account.password);

      // Build the data object (Business logic stays in service)
      const dbPayload = {
        studentId: uniqueStudentId,
        studentName: account.fullName,
        enrollmentDate: new Date(account.enrollmentDate),
        status: "ACTIVE" as const,
        currentGpa: 0.0,
        attendanceRate: 100.0,
        account: { create: { portalEmail: account.email, passwordHash: hashedPassword } },
        demographics: { create: { dateOfBirth: new Date(demographics.dateOfBirth), gender: demographics.gender, residentialAddress: demographics.residentialAddress, medicalNotes: demographics.medicalNotes ?? null, bloodType: demographics.bloodType ?? null, religion: demographics.religion ?? null, formerSchool: demographics.formerSchool ?? null } },
        placement: { create: { classId: placement.classId, academicTrack: placement.academicTrack, boardingStatus: placement.boardingStatus } },
        guardians: { create: { name: guardian.name, relationship: guardian.relationship, phone: guardian.phone, email: guardian.email ?? null } },
        billing: { create: { feeTierId: billing.feeTierId, initialDeposit: billing.initialDeposit, currentBalance: computedBalance } },
        compliance: { create: { nationalId: compliance?.nationalId ?? null, emergencyName: compliance?.emergencyContact?.name ?? null, emergencyPhone: compliance?.emergencyContact?.phone ?? null, emergencyRelation: compliance?.emergencyContact?.relationship ?? null } },
      };

      // ✅ Delegated to repository, passing the transaction client
      return this.repo.createNestedStudent(dbPayload, tx);
    });
  }

  /**
   * Processes the atomic offboarding of a student.
   */
  async processDeparture(payload: {
    studentId: string;
    departureType: string;
    effectiveDate: string;
    disposition: { destinationInstitution?: string; treasuryClearanceStatus: string; academicRecordsArchived: boolean };
    remarks: string;
  }) {
    const { studentId, departureType, effectiveDate, disposition, remarks } = payload;

    // ✅ Delegated to repository
    const studentRecord = await this.repo.findByPublicId(studentId);

    if (!studentRecord) {
      throw new Error(`Target student registry lookup failed. No active record found for ID: ${studentId}`);
    }

    if (studentRecord.status === "DEPARTED") {
      throw new Error(`System conflict: Student ${studentId} has already been processed for departure.`);
    }

    // Service controls the transaction, repo executes the queries
    return await prisma.$transaction(async (tx) => {
      const departureLog = await this.repo.createDepartureLog({
        studentInternalId: studentRecord.id,
        departureType: departureType as any,
        effectiveDate: new Date(effectiveDate),
        destinationInstitution: disposition.destinationInstitution || "N/A",
        treasuryClearanceStatus: disposition.treasuryClearanceStatus as any,
        academicRecordsArchived: disposition.academicRecordsArchived,
        remarks,
      }, tx);

      // ✅ Delegated to repository, passing the transaction client
      await this.repo.updateStatus(studentRecord.id, "DEPARTED", tx);

      return departureLog;
    });
  }
}