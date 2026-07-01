import { prisma } from "@/lib/prisma";

export class FinanceRepository {
  // =========================================================================
  // FEE STRUCTURES
  // =========================================================================
  async findAllFeeConfigurations(tx: any = prisma) {
    return tx.feeStructureConfiguration.findMany({ include: { components: true } });
  }

  async findFeeConfigBySection(sectionId: string, tx: any = prisma) {
    return tx.feeStructureConfiguration.findUnique({
      where: { sectionId },
      include: { components: true },
    });
  }

  async deleteFeeConfigBySection(sectionId: string, tx: any = prisma) {
    return tx.feeStructureConfiguration.deleteMany({ where: { sectionId } });
  }

  async createFeeConfig(data: any, tx: any = prisma) {
    return tx.feeStructureConfiguration.create({ data });
  }

  // =========================================================================
  // PAYMENT COLLECTIONS (INFLOW)
  // =========================================================================
  async findCollectionsBySection(sectionId: string, tx: any = prisma) {
    return tx.paymentCollection.findMany({
      where: { sectionId },
      orderBy: { dateProcessed: 'desc' },
    });
  }

  async countCollections(tx: any = prisma) {
    return tx.paymentCollection.count();
  }

  async createCollection(data: any, tx: any = prisma) {
    return tx.paymentCollection.create({ data });
  }

  // =========================================================================
  // STUDENT FINANCIALS (INVOICES & LEDGERS)
  // =========================================================================
  async findStudentsBySection(sectionId: string, tx: any = prisma) {
    return tx.student.findMany({
      where: { placement: { classId: sectionId }, status: { not: "DEPARTED" } },
      select: { id: true, studentId: true, studentName: true, billing: { select: { currentBalance: true } } },
      orderBy: { studentName: 'asc' },
    });
  }

  async findStudentsMinimalBySection(sectionId: string, tx: any = prisma) {
    return tx.student.findMany({
      where: { placement: { classId: sectionId }, status: { not: "DEPARTED" } },
      select: { id: true, studentId: true },
    });
  }

  async findExistingInvoice(studentId: string, configId: string, tx: any = prisma) {
    return tx.invoice.findFirst({ where: { studentId, configId } });
  }

  async countInvoices(tx: any = prisma) {
    return tx.invoice.count();
  }

  async createInvoice(data: any, tx: any = prisma) {
    return tx.invoice.create({ data });
  }

  async findOldestUnpaidInvoice(studentId: string, tx: any = prisma) {
    return tx.invoice.findFirst({
      where: { studentId, status: "UNPAID" },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markInvoicePaid(invoiceId: string, tx: any = prisma) {
    return tx.invoice.update({ where: { id: invoiceId }, data: { status: "PAID" } });
  }

  async decrementBillingLedger(studentId: string, amount: number, tx: any = prisma) {
    return tx.billingLedger.update({
      where: { studentId },
      data: { currentBalance: { decrement: amount } },
    });
  }

  async upsertBillingLedger(studentId: string, feeTierId: string, amount: number, tx: any = prisma) {
    return tx.billingLedger.upsert({
      where: { studentId },
      update: { currentBalance: { increment: amount } },
      create: { studentId, feeTierId, initialDeposit: 0, currentBalance: amount },
    });
  }

  async countStudentPayments(tx: any = prisma) {
    return tx.payment.count();
  }

  async createStudentPayment(data: any, tx: any = prisma) {
    return tx.payment.create({ data });
  }

  // =========================================================================
  // GENERAL LEDGER & PAYROLL
  // =========================================================================
  async findAllLedgerAccounts(tx: any = prisma) {
    return tx.ledgerAccount.findMany({ orderBy: { code: 'asc' } });
  }

  async createLedgerAccount(data: any, tx: any = prisma) {
    return tx.ledgerAccount.create({ data });
  }

  async getAllStaffPayroll(tx: any = prisma) {
    return tx.staffPayroll.findMany({
      include: { staff: { select: { staffName: true, account: { select: { role: true } } } } },
    });
  }

  async getAllTeacherPayroll(tx: any = prisma) {
    return tx.teacherPayroll.findMany({
      include: { teacher: { select: { teacherName: true, subject: true } } },
    });
  }

  async findStaffPayrollById(id: string, tx: any = prisma) {
    return tx.staffPayroll.findUnique({ where: { id } });
  }

  async disburseStaffPayroll(id: string, tx: any = prisma) {
    return tx.staffPayroll.update({ where: { id }, data: { salaryStatus: "DISBURSED" } });
  }

  async findTeacherPayrollById(id: string, tx: any = prisma) {
    return tx.teacherPayroll.findUnique({ where: { id } });
  }

  async disburseTeacherPayroll(id: string, tx: any = prisma) {
    return tx.teacherPayroll.update({ where: { id }, data: { salaryStatus: "DISBURSED" } });
  }
}