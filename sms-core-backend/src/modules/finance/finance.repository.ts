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

  // SMS-007: full receipt projection (class + linked student + live balance)
  async findReceiptCollectionById(collectionId: string, tx: TransactionClient = prisma) {
    return tx.paymentCollection.findUnique({
      where: { id: collectionId },
      include: {
        class: { select: { id: true, name: true, section: true } },
        student: { select: { studentId: true, photoKey: true, billing: { select: { currentBalance: true, creditBalance: true } } } },
      },
    });
  }

  // Singleton system configuration used to brand receipt renderers.
  async findReceiptInstitution(tx: TransactionClient = prisma) {
    return tx.systemConfig.findUnique({
      where: { id: 1 },
      select: {
        schoolName: true,
        schoolCode: true,
        motto: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        currency: true,
      },
    });
  }

  async findStudentsBySection(sectionId: string, tx: TransactionClient = prisma) {
    return tx.student.findMany({
      where: { placement: { classId: sectionId }, status: { not: 'DEPARTED' } },
      select: { id: true, studentId: true, studentName: true, billing: { select: { currentBalance: true, creditBalance: true } } },
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

  /**
   * Applies a payment to the oldest open invoices first. Any amount that
   * cannot be applied to an invoice is carried into BillingLedger.creditBalance.
   * If no invoice exists yet, the amount first reduces the legacy ledger
   * balance and only the remainder becomes credit.
   */
  async allocatePayment(studentId: string, amount: number, tx: TransactionClient = prisma) {
    let remaining = Math.max(amount, 0);
    let appliedToInvoices = 0;
    let foundInvoice = false;

    while (remaining > 0.000001) {
      const unpaidInvoice = await this.findOldestUnpaidInvoice(studentId, tx);
      if (!unpaidInvoice) break;
      foundInvoice = true;

      const result = await this.applyPaymentToInvoice(unpaidInvoice.id, remaining, tx);
      if (!result || result.applied <= 0) break;

      appliedToInvoices += result.applied;
      remaining = result.overage;
    }

    const ledger = await tx.billingLedger.findUnique({ where: { studentId } });
    if (!ledger) {
      if (remaining > 0.000001) {
        await tx.billingLedger.create({
          data: {
            studentId,
            initialDeposit: 0,
            currentBalance: 0,
            creditBalance: remaining,
          },
        });
      }
      return { appliedToInvoices, appliedToLedger: 0, credited: remaining };
    }

    const currentBalance = Math.max(parseFloat(ledger.currentBalance.toString()), 0);
    const appliedToLedger = foundInvoice
      ? 0
      : Math.min(remaining, currentBalance);
    const credited = Math.max(remaining - appliedToLedger, 0);

    await tx.billingLedger.update({
      where: { studentId },
      data: {
        currentBalance: Math.max(currentBalance - appliedToInvoices - appliedToLedger, 0),
        creditBalance: { increment: credited },
      },
    });

    return { appliedToInvoices, appliedToLedger, credited };
  }

  /**
   * Automatically spends a student's stored credit against the oldest open
   * invoices. This is called immediately after a new invoice is generated.
   */
  async applyAvailableCredit(studentId: string, tx: TransactionClient = prisma) {
    const ledger = await tx.billingLedger.findUnique({ where: { studentId } });
    if (!ledger) return { applied: 0, remainingCredit: 0 };

    let remainingCredit = Math.max(parseFloat(ledger.creditBalance.toString()), 0);
    let applied = 0;

    while (remainingCredit > 0.000001) {
      const unpaidInvoice = await this.findOldestUnpaidInvoice(studentId, tx);
      if (!unpaidInvoice) break;

      const result = await this.applyPaymentToInvoice(unpaidInvoice.id, remainingCredit, tx);
      if (!result || result.applied <= 0) break;

      applied += result.applied;
      remainingCredit = result.overage;
    }

    const currentBalance = Math.max(parseFloat(ledger.currentBalance.toString()), 0);
    await tx.billingLedger.update({
      where: { studentId },
      data: {
        currentBalance: Math.max(currentBalance - applied, 0),
        creditBalance: remainingCredit,
      },
    });

    return { applied, remainingCredit };
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

  async findCollectionsForDateRange(startDate: Date, endDate: Date, tx: TransactionClient = prisma) {
    return tx.paymentCollection.findMany({
      where: {
        deletedAt: null,
        dateProcessed: { gte: startDate, lt: endDate },
      },
      include: {
        class: { select: { name: true, section: true } },
        student: { select: { studentId: true } },
      },
      orderBy: [
        { dateProcessed: 'asc' },
        { receiptNumber: 'asc' },
      ],
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
