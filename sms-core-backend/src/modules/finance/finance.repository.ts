import { prisma } from "@/lib/prisma";
import { IFinanceRepository, TransactionClient, FeeConfigCreateData, CollectionCreateData, InvoiceCreateData, StudentPaymentCreateData, LedgerAccountCreateData } from "@/types/repositories";

export class FinanceRepository implements IFinanceRepository {
  async findAllFeeConfigurations(tx: TransactionClient = prisma) {
    return tx.feeStructureConfiguration.findMany({ include: { components: true } });
  }

  async findFeeConfigBySection(sectionId: string, tx: TransactionClient = prisma) {
    return tx.feeStructureConfiguration.findUnique({
      where: { sectionId },
      include: { components: true },
    });
  }

  async deleteFeeConfigBySection(sectionId: string, tx: TransactionClient = prisma) {
    return tx.feeStructureConfiguration.deleteMany({ where: { sectionId } });
  }

  async createFeeConfig(data: FeeConfigCreateData, tx: TransactionClient = prisma) {
    return tx.feeStructureConfiguration.create({ data });
  }

  async findCollectionsBySection(sectionId: string, tx: TransactionClient = prisma) {
    return tx.paymentCollection.findMany({
      where: { sectionId },
      orderBy: { dateProcessed: 'desc' },
    });
  }

  async countCollections(tx: TransactionClient = prisma) {
    return tx.paymentCollection.count();
  }

  async createCollection(data: CollectionCreateData, tx: TransactionClient = prisma) {
    return tx.paymentCollection.create({ data });
  }

  async findStudentsBySection(sectionId: string, tx: TransactionClient = prisma) {
    return tx.student.findMany({
      where: { placement: { classId: sectionId }, status: { not: "DEPARTED" } },
      select: { id: true, studentId: true, studentName: true, billing: { select: { currentBalance: true } } },
      orderBy: { studentName: 'asc' },
    });
  }

  async findStudentsMinimalBySection(sectionId: string, tx: TransactionClient = prisma) {
    return tx.student.findMany({
      where: { placement: { classId: sectionId }, status: { not: "DEPARTED" } },
      select: { id: true, studentId: true },
    });
  }

  async findExistingInvoice(studentId: string, configId: string, tx: TransactionClient = prisma) {
    return tx.invoice.findFirst({ where: { studentId, configId } });
  }

  async countInvoices(tx: TransactionClient = prisma) {
    return tx.invoice.count();
  }

  async createInvoice(data: InvoiceCreateData, tx: TransactionClient = prisma) {
    return tx.invoice.create({ data });
  }

  async findOldestUnpaidInvoice(studentId: string, tx: TransactionClient = prisma) {
    return tx.invoice.findFirst({
      where: { studentId, status: "UNPAID" },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markInvoicePaid(invoiceId: string, tx: TransactionClient = prisma) {
    return tx.invoice.update({ where: { id: invoiceId }, data: { status: "PAID" } });
  }

  // ── P0-5: Billing ledger floor constraint at zero ──
  // Uses an atomic UPDATE...WHERE to prevent negative balances
  // even under concurrent payment requests. The WHERE clause
  // ensures currentBalance >= amount, so the decrement can
  // never push the balance below zero. If zero rows are
  // affected, we follow up with a SELECT only to determine
  // which condition failed (missing ledger vs. insufficient
  // balance) and return a precise error message.
  async decrementBillingLedger(studentId: string, amount: number, tx: TransactionClient = prisma) {
    if (amount <= 0) {
      throw new Error(`Invalid decrement amount: ${amount}. Must be a positive number.`);
    }

    // Cast to ::numeric to match PostgreSQL Decimal column type
    const result = await tx.$executeRaw`
      UPDATE "BillingLedger" 
      SET "currentBalance" = "currentBalance" - ${amount}::numeric 
      WHERE "studentId" = ${studentId} 
      AND "currentBalance" >= ${amount}::numeric
    `;

    if (result === 0) {
      const ledger = await tx.billingLedger.findUnique({ where: { studentId } });
      if (!ledger) {
        throw new Error(`Billing ledger not found for student: ${studentId}`);
      }
      throw new Error(
        `Payment amount (${amount}) exceeds outstanding balance (${Number(ledger.currentBalance)}) for student ${studentId}. ` +
        `Overpayments are not supported in the current billing model.`
      );
    }

    return tx.billingLedger.findUnique({ where: { studentId } });
  }

  async upsertBillingLedger(studentId: string, feeTierId: string, amount: number, tx: TransactionClient = prisma) {
    if (amount < 0) {
      throw new Error(`Invalid fee amount: ${amount}. Cannot add negative fees to billing ledger.`);
    }
    return tx.billingLedger.upsert({
      where: { studentId },
      update: { currentBalance: { increment: amount } },
      create: { studentId, feeTierId, initialDeposit: 0, currentBalance: amount },
    });
  }

  async countStudentPayments(tx: TransactionClient = prisma) {
    return tx.payment.count();
  }

  async createStudentPayment(data: StudentPaymentCreateData, tx: TransactionClient = prisma) {
    return tx.payment.create({ data });
  }

  async findAllLedgerAccounts(skip?: number, take?: number, tx: TransactionClient = prisma) {
    return tx.ledgerAccount.findMany({
      skip: skip ?? undefined,
      take: take ?? undefined,
      orderBy: { code: 'asc' },
    });
  }

  async countLedgerAccounts(tx: TransactionClient = prisma) {
    return tx.ledgerAccount.count();
  }

  async createLedgerAccount(data: LedgerAccountCreateData, tx: TransactionClient = prisma) {
    return tx.ledgerAccount.create({ data });
  }

  async getAllStaffPayroll(skip?: number, take?: number, tx: TransactionClient = prisma) {
    return tx.staffPayroll.findMany({
      skip: skip ?? undefined,
      take: take ?? undefined,
      include: { staff: { select: { staffName: true, account: { select: { role: true } } } } },
    });
  }

  async getAllTeacherPayroll(skip?: number, take?: number, tx: TransactionClient = prisma) {
    return tx.teacherPayroll.findMany({
      skip: skip ?? undefined,
      take: take ?? undefined,
      include: { teacher: { select: { teacherName: true, subject: true } } },
    });
  }

  async countStaffPayroll(tx: TransactionClient = prisma) {
    return tx.staffPayroll.count();
  }

  async countTeacherPayroll(tx: TransactionClient = prisma) {
    return tx.teacherPayroll.count();
  }

  async findStaffPayrollById(id: string, tx: TransactionClient = prisma) {
    return tx.staffPayroll.findUnique({ where: { id } });
  }

  async findTeacherPayrollById(id: string, tx: TransactionClient = prisma) {
    return tx.teacherPayroll.findUnique({ where: { id } });
  }

  // ── P0-3: Payroll disbursement with financial controls ──
  // Uses an atomic UPDATE...WHERE to enforce three rules in a
  // single database operation, preventing race conditions between
  // concurrent disbursement requests:
  //   1. Idempotency: salaryStatus must not already be DISBURSED
  //   2. Amount validity: netPay must be greater than zero
  //   3. Record existence: the payroll record must exist
  // If zero rows are affected, a follow-up SELECT determines
  // which condition failed and returns a precise error message.
  async disburseStaffPayroll(id: string, tx: TransactionClient = prisma) {
    const result = await tx.$executeRaw`
      UPDATE "StaffPayroll" 
      SET "salaryStatus" = 'DISBURSED' 
      WHERE "id" = ${id} 
      AND "salaryStatus" != 'DISBURSED' 
      AND "netPay" > 0
    `;

    if (result === 0) {
      const payroll = await tx.staffPayroll.findUnique({ where: { id } });
      if (!payroll) {
        throw new Error(`Staff payroll record not found: ${id}`);
      }
      if (payroll.salaryStatus === "DISBURSED") {
        throw new Error(
          `Double-disbursement prevented: Staff payroll ${id} was already marked as DISBURSED. ` +
          `Request the full payroll and ledger audit trail for verification.`
        );
      }
      throw new Error(
        `Invalid disbursement blocked: Staff payroll ${id} has netPay of ${Number(payroll.netPay)}. ` +
        `Cannot disburse zero or negative amounts.`
      );
    }

    return tx.staffPayroll.findUnique({ where: { id } });
  }

  async disburseTeacherPayroll(id: string, tx: TransactionClient = prisma) {
    const result = await tx.$executeRaw`
      UPDATE "TeacherPayroll" 
      SET "salaryStatus" = 'DISBURSED' 
      WHERE "id" = ${id} 
      AND "salaryStatus" != 'DISBURSED' 
      AND "netPay" > 0
    `;

    if (result === 0) {
      const payroll = await tx.teacherPayroll.findUnique({ where: { id } });
      if (!payroll) {
        throw new Error(`Teacher payroll record not found: ${id}`);
      }
      if (payroll.salaryStatus === "DISBURSED") {
        throw new Error(
          `Double-disbursement prevented: Teacher payroll ${id} was already marked as DISBURSED. ` +
          `Request the full payroll and ledger audit trail for verification.`
        );
      }
      throw new Error(
        `Invalid disbursement blocked: Teacher payroll ${id} has netPay of ${Number(payroll.netPay)}. ` +
        `Cannot disburse zero or negative amounts.`
      );
    }

    return tx.teacherPayroll.findUnique({ where: { id } });
  }
}
