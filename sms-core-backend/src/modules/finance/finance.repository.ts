import { prisma } from '@/lib/prisma';
import { IFinanceRepository, TransactionClient, FeeConfigCreateData, CollectionCreateData, InvoiceCreateData, StudentPaymentCreateData, LedgerAccountCreateData } from '@/types/repositories';

export class FinanceRepository implements IFinanceRepository {
  async findAllFeeConfigurations(tx: TransactionClient = prisma) {
    return tx.feeStructureConfiguration.findMany({
      where: { deletedAt: null },
      include: { components: true },
    });
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
      where: { sectionId, deletedAt: null },
      orderBy: { dateProcessed: 'desc' },
    });
  }

  async findCollectionsBySectionPaginated(sectionId: string, skip: number, take: number, tx: TransactionClient = prisma) {
    return tx.paymentCollection.findMany({
      where: { sectionId, deletedAt: null },
      orderBy: { dateProcessed: 'desc' },
      skip, take,
    });
  }

  async countCollectionsBySection(sectionId: string, tx: TransactionClient = prisma) {
    return tx.paymentCollection.count({ where: { sectionId, deletedAt: null } });
  }

  async countCollections(tx: TransactionClient = prisma) {
    return tx.paymentCollection.count();
  }

  async createCollection(data: CollectionCreateData, tx: TransactionClient = prisma) {
    return tx.paymentCollection.create({ data });
  }

  async findStudentsBySection(sectionId: string, tx: TransactionClient = prisma) {
    return tx.student.findMany({
      where: { placement: { classId: sectionId }, status: { not: 'DEPARTED' } },
      select: { id: true, studentId: true, studentName: true, billing: { select: { currentBalance: true } } },
      orderBy: { studentName: 'asc' },
    });
  }

  async findStudentsMinimalBySection(sectionId: string, tx: TransactionClient = prisma) {
    return tx.student.findMany({
      where: { placement: { classId: sectionId }, status: { not: 'DEPARTED' } },
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
      where: { studentId, status: { in: ['UNPAID', 'PARTIAL'] } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markInvoicePaid(invoiceId: string, tx: TransactionClient = prisma) {
    return tx.invoice.update({ where: { id: invoiceId }, data: { status: 'PAID' } });
  }

  async applyPaymentToInvoice(invoiceId: string, amount: number, tx: TransactionClient = prisma) {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return { applied: 0, overage: 0, invoice: null };
    const alreadyPaid = parseFloat(invoice.paidAmount.toString());
    const total = parseFloat(invoice.amount.toString());
    const outstanding = Math.max(total - alreadyPaid, 0);
    const applied = Math.min(amount, outstanding);
    const overage = Math.max(amount - applied, 0);
    const newPaid = alreadyPaid + applied;
    let status: 'UNPAID' | 'PARTIAL' | 'PAID' = 'PARTIAL';
    if (newPaid >= total - 0.005) status = 'PAID';
    if (newPaid <= 0) status = 'UNPAID';
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount: newPaid, status },
    });
    return { applied, overage, invoice: updated };
  }

  async findAllInvoices(skip?: number, take?: number, tx: TransactionClient = prisma) {
    return tx.invoice.findMany({
      skip: skip ?? undefined, take: take ?? undefined,
      orderBy: { createdAt: 'desc' },
      include: { student: { select: { studentId: true, studentName: true } } },
    });
  }

  async countAllInvoices(tx: TransactionClient = prisma) {
    return tx.invoice.count({ where: { deletedAt: null } });
  }

  async decrementBillingLedger(studentId: string, amount: number, tx: TransactionClient = prisma) {
    // Clamp balance at 0 — a payment should never produce a negative balance.
    const ledger = await tx.billingLedger.findUnique({ where: { studentId } });
    if (!ledger) return null;
    const current = parseFloat(ledger.currentBalance.toString());
    const newBalance = Math.max(current - amount, 0);
    return tx.billingLedger.update({
      where: { studentId },
      data: { currentBalance: newBalance },
    });
  }

  async upsertBillingLedger(studentId: string, feeTierId: string | null, amount: number, tx: TransactionClient = prisma) {
    return tx.billingLedger.upsert({
      where: { studentId },
      update: { currentBalance: { increment: amount } },
      create: { studentId, feeTierId: feeTierId ?? undefined, initialDeposit: 0, currentBalance: amount },
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
      skip: skip ?? undefined, take: take ?? undefined,
      orderBy: { code: 'asc' },
    });
  }

  async countLedgerAccounts(tx: TransactionClient = prisma) {
    return tx.ledgerAccount.count({ where: { deletedAt: null } });
  }

  async createLedgerAccount(data: LedgerAccountCreateData, tx: TransactionClient = prisma) {
    return tx.ledgerAccount.create({ data });
  }

  async getAllStaffPayroll(skip?: number, take?: number, tx: TransactionClient = prisma) {
    return tx.staffPayroll.findMany({
      skip: skip ?? undefined, take: take ?? undefined,
      include: { staff: { select: { staffName: true, account: { select: { role: true } } } } },
    });
  }

  async getAllTeacherPayroll(skip?: number, take?: number, tx: TransactionClient = prisma) {
    return tx.teacherPayroll.findMany({
      skip: skip ?? undefined, take: take ?? undefined,
      include: { teacher: { select: { teacherName: true, subject: true } } },
    });
  }

  async countStaffPayroll(tx: TransactionClient = prisma) { return tx.staffPayroll.count(); }
  async countTeacherPayroll(tx: TransactionClient = prisma) { return tx.teacherPayroll.count(); }
  async findStaffPayrollById(id: string, tx: TransactionClient = prisma) { return tx.staffPayroll.findUnique({ where: { id } }); }
  async disburseStaffPayroll(id: string, tx: TransactionClient = prisma) { return tx.staffPayroll.update({ where: { id }, data: { salaryStatus: 'DISBURSED' } }); }
  async findTeacherPayrollById(id: string, tx: TransactionClient = prisma) { return tx.teacherPayroll.findUnique({ where: { id } }); }
  async disburseTeacherPayroll(id: string, tx: TransactionClient = prisma) { return tx.teacherPayroll.update({ where: { id }, data: { salaryStatus: 'DISBURSED' } }); }

  async findAllCollections(skip?: number, take?: number, tx: TransactionClient = prisma) {
    return tx.paymentCollection.findMany({
      skip: skip ?? undefined, take: take ?? undefined,
      orderBy: { dateProcessed: 'desc' },
    });
  }

  async countAllCollections(tx: TransactionClient = prisma) {
    return tx.paymentCollection.count({ where: { deletedAt: null } });
  }

  async findAllExpenses(skip?: number, take?: number, tx: TransactionClient = prisma) {
    return tx.expense.findMany({
      skip: skip ?? undefined, take: take ?? undefined,
      orderBy: { expenseDate: 'desc' },
    });
  }

  async countAllExpenses(tx: TransactionClient = prisma) {
    return tx.expense.count({ where: { deletedAt: null } });
  }


  async findExpenseById(id: string, tx: TransactionClient = prisma) {
    return tx.expense.findUnique({ where: { id, deletedAt: null } });
  }

  async updateExpenseStatus(id: string, status: "PENDING_APPROVAL" | "CLEARED" | "REJECTED", tx: TransactionClient = prisma) {
    return tx.expense.update({
      where: { id },
      data: { status },
    });
  }

  async createExpense(data: Record<string, unknown>, tx: TransactionClient = prisma) {
    return tx.expense.create({ data: data as never });
  }
}
