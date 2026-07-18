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

  // P2-13: Paginated variant for section ledger -- prevents unbounded
  // result sets as payment history grows over time.
  async findCollectionsBySectionPaginated(sectionId: string, skip: number, take: number, tx: TransactionClient = prisma) {
    return tx.paymentCollection.findMany({
      where: { sectionId },
      orderBy: { dateProcessed: 'desc' },
      skip,
      take,
    });
  }

  // P2-13: Count collections for a specific section (for pagination total)
  async countCollectionsBySection(sectionId: string, tx: TransactionClient = prisma) {
    return tx.paymentCollection.count({ where: { sectionId } });
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

  async findExistingInvoiceStudentIds(studentIds: string[], configId: string, tx: TransactionClient = prisma): Promise<Set<string>> {
    if (studentIds.length === 0) return new Set();
    const rows = await tx.invoice.findMany({
      where: { studentId: { in: studentIds }, configId },
      select: { studentId: true },
    });
    return new Set(rows.map((r) => r.studentId));
  }

  async countInvoices(tx: TransactionClient = prisma) {
    return tx.invoice.count();
  }

  async createInvoice(data: InvoiceCreateData, tx: TransactionClient = prisma) {
    return tx.invoice.create({ data });
  }

  async findOldestUnpaidInvoice(studentId: string, tx: TransactionClient = prisma) {
    return tx.invoice.findFirst({
      where: { studentId, status: { in: ["UNPAID", "PARTIAL"] } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markInvoicePaid(invoiceId: string, tx: TransactionClient = prisma) {
    return tx.invoice.update({ where: { id: invoiceId }, data: { status: "PAID" } });
  }

  async applyPaymentToInvoice(invoiceId: string, amount: number, tx: TransactionClient = prisma) {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return null;
    const newPaid = parseFloat(invoice.paidAmount.toString()) + amount;
    const total = parseFloat(invoice.amount.toString());
    let status: "UNPAID" | "PARTIAL" | "PAID" = "PARTIAL";
    if (newPaid >= total) status = "PAID";
    if (newPaid <= 0) status = "UNPAID";
    return tx.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount: newPaid, status },
    });
  }

  async findAllInvoices(skip?: number, take?: number, tx: TransactionClient = prisma) {
    return tx.invoice.findMany({
      skip: skip ?? undefined,
      take: take ?? undefined,
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { studentId: true, studentName: true } },
      },
    });
  }

  async countAllInvoices(tx: TransactionClient = prisma) {
    return tx.invoice.count();
  }

  async decrementBillingLedger(studentId: string, amount: number, tx: TransactionClient = prisma) {
    return tx.billingLedger.update({
      where: { studentId },
      data: { currentBalance: { decrement: amount } },
    });
  }

  async upsertBillingLedger(studentId: string, feeTierId: string, amount: number, tx: TransactionClient = prisma) {
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

  async disburseStaffPayroll(id: string, tx: TransactionClient = prisma) {
    return tx.staffPayroll.update({ where: { id }, data: { salaryStatus: "DISBURSED" } });
  }

  async findTeacherPayrollById(id: string, tx: TransactionClient = prisma) {
    return tx.teacherPayroll.findUnique({ where: { id } });
  }

  async disburseTeacherPayroll(id: string, tx: TransactionClient = prisma) {
    return tx.teacherPayroll.update({ where: { id }, data: { salaryStatus: "DISBURSED" } });
  }

  async findAllCollections(skip?: number, take?: number, tx: TransactionClient = prisma) {
    return tx.paymentCollection.findMany({
      skip: skip ?? undefined,
      take: take ?? undefined,
      orderBy: { dateProcessed: 'desc' },
    });
  }

  async countAllCollections(tx: TransactionClient = prisma) {
    return tx.paymentCollection.count();
  }
}
