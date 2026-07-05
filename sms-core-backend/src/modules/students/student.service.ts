import { prisma } from "@/lib/prisma";
import { StudentRepository } from "./student.repository";
import { formatInstitutionalId } from "@/utils";
import { hashPassword } from "@/utils/hash";

// ── TARIFF CONFIGURATION ──
const FEE_TARIFFS: Record<string, number> = {
  "tier-std": 2500,
  "tier-aid": 1250,
  "tier-sch": 0,
};

const calculateInitialBalance = (feeTierId: string, deposit: number): number => {
  const baseTariff = FEE_TARIFFS[feeTierId] ?? 0;
  return Math.max(0, baseTariff - deposit);
};

// ── INTERNAL TYPES ──
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

// ── SERVICE ──
export class StudentService {
  private repo = new StudentRepository();

  /**
   * Fetch raw relational graph (UI passthrough)
   */
  async getAll() {
    return this.repo.findAll();
  }

  /**
   * Optimized Financial Matrix Compiler
   * Uses DB aggregation + O(1) lookup maps to eliminate N+1 computation.
   */
  async getFinancialMatrix() {
    // 1. Base student graph
    const students = await this.repo.findWithFinancialData();

    // 2. Aggregate invoices in DB
    const invoiceAggregates = await prisma.invoice.groupBy({
      by: ["studentId"],
      _sum: { amount: true },
    });

    // 3. Aggregate payments in DB
    const paymentAggregates = await prisma.payment.groupBy({
      by: ["studentId"],
      _sum: { amount: true },
    });

    // 4. Build fast lookup maps
    const invoiceMap = new Map(
      invoiceAggregates.map((i) => [
        i.studentId,
        Number(i._sum.amount || 0),
      ])
    );

    const paymentMap = new Map(
      paymentAggregates.map((p) => [
        p.studentId,
        Number(p._sum.amount || 0),
      ])
    );

    // 5. Build final matrix
    return students.map((student: any) => {
      const totalInvoiced = invoiceMap.get(student.id) || 0;
      const totalPaid = paymentMap.get(student.id) || 0;

      const balanceRemaining = Math.max(0, totalInvoiced - totalPaid);

      let feesStatus: "Paid" | "Partial" | "Unpaid" = "Unpaid";

      if (balanceRemaining <= 0 && totalPaid > 0) {
        feesStatus = "Paid";
      } else if (totalPaid > 0 && balanceRemaining > 0) {
        feesStatus = "Partial";
      }

      const invoices = (student.invoices || []) as InvoiceType[];
      const payments = (student.payments || []) as PaymentType[];

      const lastInvoice = invoices[invoices.length - 1];
      const lastPayment = payments[payments.length - 1];

      return {
        id: student.id,
        studentId: student.studentId,
        studentName: student.studentName,
        status: student.status,
        account: student.account,
        feesStatus,
        lastTransactionId:
          lastPayment?.receiptNo || lastInvoice?.invoiceNo || "—",
        lastTransactionDate:
          lastPayment?.createdAt || lastInvoice?.createdAt || "—",
        paymentType:
          lastPayment?.paymentType || (lastInvoice ? "Invoice" : "—"),
        amountPaid: totalPaid,
        balanceRemaining,
      };
    });
  }

  /**
   * Student creation (unchanged core logic)
   */
  async createStudent(payload: {
    account: {
      fullName: string;
      email: string;
      password: string;
      enrollmentDate: string;
    };
    demographics: {
      dateOfBirth: string;
      gender: string;
      residentialAddress: string;
      medicalNotes?: string | null;
      bloodType?: string | null;
      religion?: string | null;
      formerSchool?: string | null;
    };
    placement: {
      classId: string;
      academicTrack: string;
      boardingStatus: string;
    };
    guardian?: {
      name: string;
      relationship: string;
      phone: string;
      email?: string | null;
    };
    parent?: {
      name: string;
      relationship: string;
      phone: string;
      email?: string | null;
    };
    billing: { feeTierId: string; initialDeposit: number };
    compliance?: {
      nationalId?: string | null;
      emergencyContact?: {
        name?: string | null;
        phone?: string | null;
        relationship?: string | null;
      } | null;
    };
  }) {
    const {
      account,
      demographics,
      placement,
      guardian,
      parent,
      billing,
      compliance,
    } = payload;

    const resolvedGuardian = guardian || parent;

    if (!resolvedGuardian) {
      throw new Error(
        "Missing essential guardian contact relationships from structural payload."
      );
    }

    const uniqueStudentId = formatInstitutionalId("STU", "2026");
    const computedBalance = calculateInitialBalance(
      billing.feeTierId,
      billing.initialDeposit
    );

    return await prisma.$transaction(async (tx) => {
      const hashedPassword = await hashPassword(account.password);

      const dbPayload = {
        studentId: uniqueStudentId,
        studentName: account.fullName,
        enrollmentDate: new Date(account.enrollmentDate),
        status: "ACTIVE" as const,
        currentGpa: 0.0,
        attendanceRate: 100.0,

        account: {
          create: {
            portalEmail: account.email,
            passwordHash: hashedPassword,
          },
        },

        demographics: {
          create: {
            dateOfBirth: new Date(demographics.dateOfBirth),
            gender: demographics.gender,
            residentialAddress: demographics.residentialAddress,
            medicalNotes: demographics.medicalNotes ?? null,
            bloodType: demographics.bloodType ?? null,
            religion: demographics.religion ?? null,
            formerSchool: demographics.formerSchool ?? null,
          },
        },

        placement: {
          create: {
            classId: placement.classId,
            academicTrack: placement.academicTrack,
            boardingStatus: placement.boardingStatus,
          },
        },

        guardians: {
          create: {
            name: resolvedGuardian.name,
            relationship: resolvedGuardian.relationship,
            phone: resolvedGuardian.phone,
            email: resolvedGuardian.email ?? null,
          },
        },

        billing: {
          create: {
            feeTierId: billing.feeTierId,
            initialDeposit: billing.initialDeposit,
            currentBalance: computedBalance,
          },
        },

        compliance: {
          create: {
            nationalId: compliance?.nationalId ?? null,
            emergencyName: compliance?.emergencyContact?.name ?? null,
            emergencyPhone: compliance?.emergencyContact?.phone ?? null,
            emergencyRelation:
              compliance?.emergencyContact?.relationship ?? null,
          },
        },
      };

      return this.repo.createNestedStudent(dbPayload, tx);
    });
  }

  /**
   * Student departure (unchanged logic)
   */
  async processDeparture(payload: {
    studentId: string;
    departureType: string;
    effectiveDate: string;
    disposition: {
      destinationInstitution?: string;
      treasuryClearanceStatus: string;
      academicRecordsArchived: boolean;
    };
    remarks: string;
  }) {
    const { studentId, departureType, effectiveDate, disposition, remarks } =
      payload;

    const studentRecord = await this.repo.findByPublicId(studentId);

    if (!studentRecord) {
      throw new Error(
        `Target student registry lookup failed. No active record found for ID: ${studentId}`
      );
    }

    if (studentRecord.status === "DEPARTED") {
      throw new Error(
        `System conflict: Student ${studentId} has already been processed for departure.`
      );
    }

    return await prisma.$transaction(async (tx) => {
      const departureLog = await this.repo.createDepartureLog(
        {
          studentInternalId: studentRecord.id,
          departureType: departureType as any,
          effectiveDate: new Date(effectiveDate),
          destinationInstitution:
            disposition.destinationInstitution || "N/A",
          treasuryClearanceStatus:
            disposition.treasuryClearanceStatus as any,
          academicRecordsArchived: disposition.academicRecordsArchived,
          remarks,
        },
        tx
      );

      await this.repo.updateStatus(studentRecord.id, "DEPARTED", tx);

      return departureLog;
    });
  }
}