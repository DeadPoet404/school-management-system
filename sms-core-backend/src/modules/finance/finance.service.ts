import { AppError } from '@/middleware/error.handler';
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDecimal, generateSerial } from "@/utils";
import { IFinanceRepository } from "@/types/repositories";
import { FinanceRepository } from "./finance.repository";

type FeeConfigRow = Prisma.FeeStructureConfigurationGetPayload<{ include: { components: true } }>;
type StaffPayrollRow = Prisma.StaffPayrollGetPayload<{ include: { staff: { select: { staffName: true; account: { select: { role: true } } } } } }>;
type TeacherPayrollRow = Prisma.TeacherPayrollGetPayload<{ include: { teacher: { select: { teacherName: true; subject: true } } } }>;

interface FeeMatrixSection {
  components: Array<{ id: string; name: string; amount: string | number; frequency: string; isMandatory: boolean }>;
  billingConfig: { issueDate: Date | string; dueDate: Date | string; allowInstallments: boolean; lateFeeRate: string | number };
}

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: { student: { select: { studentId: true; studentName: true } } } }>;

interface MatrixSectionData {
  components: Array<{ name?: string; amount?: string | number; frequency?: string; isMandatory?: boolean }>;
  billingConfig: { issueDate?: string | Date; dueDate?: string | Date; allowInstallments?: boolean; lateFeeRate?: string | number };
}

interface FinanceDashboardTrendPoint {
  date: string;
  invoiced: number;
  collected: number;
  expenses: number;
  payroll: number;
  outflows: number;
  netCashflow: number;
  outstanding: number;
}

export class FinanceService {
  constructor(private repo: IFinanceRepository = new FinanceRepository()) {}

  private toDashboardDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private createDashboardTrendPoint(date: string): FinanceDashboardTrendPoint {
    return {
      date,
      invoiced: 0,
      collected: 0,
      expenses: 0,
      payroll: 0,
      outflows: 0,
      netCashflow: 0,
      outstanding: 0,
    };
  }

  async getDashboardSummary(days: number = 90) {
    const safeDays = Math.min(Math.max(Math.trunc(days) || 90, 1), 365);
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - safeDays + 1);

    const [
      invoiceTotals,
      collectionTotals,
      expenseTotals,
      staffPayrollTotals,
      teacherPayrollTotals,
      invoiceStatusCounts,
      staffPayrollStatusCounts,
      teacherPayrollStatusCounts,
      trendInvoices,
      trendCollections,
      trendExpenses,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        _count: { _all: true },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.paymentCollection.aggregate({
        _count: { _all: true },
        _sum: { amountPaid: true },
      }),
      prisma.expense.aggregate({
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.staffPayroll.aggregate({
        _count: { _all: true },
        _sum: { baseSalary: true, deductions: true },
      }),
      prisma.teacherPayroll.aggregate({
        _count: { _all: true },
        _sum: { baseSalary: true, deductions: true },
      }),
      prisma.invoice.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.staffPayroll.groupBy({
        by: ['salaryStatus'],
        _count: { _all: true },
      }),
      prisma.teacherPayroll.groupBy({
        by: ['salaryStatus'],
        _count: { _all: true },
      }),
      prisma.invoice.findMany({
        where: { createdAt: { gte: startDate } },
        select: { amount: true, paidAmount: true, createdAt: true },
      }),
      prisma.paymentCollection.findMany({
        where: { dateProcessed: { gte: startDate } },
        select: { amountPaid: true, dateProcessed: true },
      }),
      prisma.expense.findMany({
        where: { expenseDate: { gte: startDate } },
        select: { amount: true, expenseDate: true },
      }),
    ]);

    const totalInvoiced = parseDecimal(invoiceTotals._sum.amount);
    const totalInvoicePayments = parseDecimal(invoiceTotals._sum.paidAmount);
    const totalCollected = parseDecimal(collectionTotals._sum.amountPaid);
    const totalExpenses = parseDecimal(expenseTotals._sum.amount);
    const staffPayroll = parseDecimal(staffPayrollTotals._sum.baseSalary) - parseDecimal(staffPayrollTotals._sum.deductions);
    const teacherPayroll = parseDecimal(teacherPayrollTotals._sum.baseSalary) - parseDecimal(teacherPayrollTotals._sum.deductions);
    const totalPayroll = staffPayroll + teacherPayroll;
    const totalOutflows = totalExpenses + totalPayroll;

    let paidInvoices = 0;
    let partialInvoices = 0;
    let unpaidInvoices = 0;

    invoiceStatusCounts.forEach((row) => {
      if (row.status === 'PAID') paidInvoices += row._count._all;
      else if (row.status === 'PARTIAL') partialInvoices += row._count._all;
      else unpaidInvoices += row._count._all;
    });

    const pendingPayroll = [...staffPayrollStatusCounts, ...teacherPayrollStatusCounts]
      .filter((row) => row.salaryStatus === 'PENDING')
      .reduce((sum, row) => sum + row._count._all, 0);

    const trendByDate = new Map<string, FinanceDashboardTrendPoint>();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (const cursor = new Date(startDate); cursor <= today; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const dateKey = this.toDashboardDateKey(cursor);
      trendByDate.set(dateKey, this.createDashboardTrendPoint(dateKey));
    }

    const getTrendPoint = (date: Date) => {
      const dateKey = this.toDashboardDateKey(date);
      const existing = trendByDate.get(dateKey);
      if (existing) return existing;

      const point = this.createDashboardTrendPoint(dateKey);
      trendByDate.set(dateKey, point);
      return point;
    };

    trendInvoices.forEach((invoice) => {
      const point = getTrendPoint(invoice.createdAt);
      const amount = parseDecimal(invoice.amount);
      const paidAmount = parseDecimal(invoice.paidAmount);

      point.invoiced += amount;
      point.outstanding += Math.max(amount - paidAmount, 0);
    });

    trendCollections.forEach((collection) => {
      const point = getTrendPoint(collection.dateProcessed);
      point.collected += parseDecimal(collection.amountPaid);
    });

    trendExpenses.forEach((expense) => {
      const point = getTrendPoint(expense.expenseDate);
      point.expenses += parseDecimal(expense.amount);
    });

    // Payroll records currently have no timestamp fields. Until payroll
    // history is modeled, represent the current payroll obligation on today.
    getTrendPoint(new Date()).payroll += totalPayroll;

    const trend = Array.from(trendByDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((point) => ({
        ...point,
        outflows: point.expenses + point.payroll,
        netCashflow: point.collected - (point.expenses + point.payroll),
      }));

    return {
      windowDays: safeDays,
      totals: {
        invoiced: totalInvoiced,
        collected: totalCollected,
        invoicePayments: totalInvoicePayments,
        outstanding: Math.max(totalInvoiced - totalInvoicePayments, 0),
        expenses: totalExpenses,
        payroll: totalPayroll,
        outflows: totalOutflows,
        netCashflow: totalCollected - totalOutflows,
      },
      counts: {
        invoices: invoiceTotals._count._all,
        collections: collectionTotals._count._all,
        expenses: expenseTotals._count._all,
        payroll: staffPayrollTotals._count._all + teacherPayrollTotals._count._all,
        paidInvoices,
        partialInvoices,
        openInvoices: unpaidInvoices + partialInvoices,
        pendingPayroll,
      },
      trend,
    };
  }

  async getGlobalMatrix(): Promise<Record<string, FeeMatrixSection>> {
    const records = (await this.repo.findAllFeeConfigurations()) as FeeConfigRow[];
    const matrix: Record<string, FeeMatrixSection> = {};

    records.forEach((rec) => {
      matrix[rec.sectionId] = {
        components: rec.components.map((c) => ({
          id: c.id,
          name: c.name,
          amount: c.amount.toString(),
          frequency: c.frequency,
          isMandatory: c.isMandatory,
        })),
        billingConfig: {
          issueDate: rec.issueDate,
          dueDate: rec.dueDate,
          allowInstallments: rec.allowInstallments,
          lateFeeRate: rec.lateFeeRate.toString(),
        },
      };
    });

    return matrix;
  }

  async replaceGlobalMatrix(matrixData: Record<string, MatrixSectionData>): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const [sectionId, sectionData] of Object.entries(matrixData)) {
        const { components, billingConfig } = sectionData;

        await this.repo.deleteFeeConfigBySection(sectionId, tx);

        await this.repo.createFeeConfig({
          sectionId,
          issueDate: billingConfig.issueDate ? new Date(billingConfig.issueDate) : new Date(),
          dueDate: billingConfig.dueDate ? new Date(billingConfig.dueDate) : new Date(),
          allowInstallments: !!billingConfig.allowInstallments,
          lateFeeRate: String(billingConfig.lateFeeRate || '0'),
          components: {
            create: components.map((c) => ({
              name: c.name || 'Unnamed Asset Fee',
              amount: String(c.amount || '0'),
              frequency: c.frequency || 'Per Term / Trimester',
              isMandatory: c.isMandatory !== undefined ? c.isMandatory : true,
            })),
          },
        }, tx);
      }
    });
  }

  async getInflowLedgerBySection(sectionId: string, skip: number = 0, limit: number = 10) {
    return await prisma.paymentCollection.findMany({
      where: { sectionId },
      skip,
      take: limit,
      orderBy: { dateProcessed: 'desc' },
    });
  }

  async countCollectionsBySection(sectionId: string) {
    return await prisma.paymentCollection.count({ where: { sectionId } });
  }

  async processInflowCollection(data: {
    sectionId: string;
    studentName: string;
    amountPaid: string;
    paymentMethod: string;
    referenceNo?: string;
    allocationTarget: string;
    studentInternalId?: string;
  }) {
    return await prisma.$transaction(async (tx) => {
      const count = await this.repo.countCollections(tx);
      const uniqueSerial = generateSerial(`REC-${new Date().getFullYear()}`, count);
      
      const collectionRecord = await this.repo.createCollection({
        receiptNumber: uniqueSerial,
        sectionId: data.sectionId,
        studentName: data.studentName,
        amountPaid: data.amountPaid,
        paymentMethod: data.paymentMethod,
        referenceNo: data.referenceNo || 'N/A (Direct)',
        allocationTarget: data.allocationTarget,
        ...(data.studentInternalId ? { studentInternalId: data.studentInternalId } : {}),
      }, tx);

      if (data.studentInternalId) {
        const numericAmount = parseDecimal(data.amountPaid);
        await this.repo.decrementBillingLedger(data.studentInternalId, numericAmount, tx);

        const paymentCount = await this.repo.countStudentPayments(tx);
        const paymentReceiptNo = generateSerial(`PAY-${new Date().getFullYear()}`, paymentCount);

        await this.repo.createStudentPayment({
          receiptNo: paymentReceiptNo,
          studentId: data.studentInternalId,
          description: `${data.allocationTarget} - ${data.paymentMethod}`,
          amount: numericAmount,
          paymentType: data.paymentMethod,
        }, tx);

        const unpaidInvoice = await this.repo.findOldestUnpaidInvoice(data.studentInternalId, tx);
        if (unpaidInvoice) {
          await this.repo.applyPaymentToInvoice(unpaidInvoice.id, numericAmount, tx);
        }
      }

      return collectionRecord;
    });
  }

  async getStudentsBySection(sectionId: string) {
    return await this.repo.findStudentsBySection(sectionId);
  }

  async generateInvoicesForSection(sectionId: string) {
    const config = await this.repo.findFeeConfigBySection(sectionId);
    if (!config) throw new AppError(404, `No fee configuration found for section: ${sectionId}`);

    const students = await this.repo.findStudentsMinimalBySection(sectionId);
    if (students.length === 0) throw new AppError(400, `No active students found in section: ${sectionId}`);

    const configTyped = config as FeeConfigRow;
    const totalFeeAmount = configTyped.components.reduce((sum, comp) => sum + parseDecimal(String(comp.amount)), 0);

    return await prisma.$transaction(async (tx) => {
      // Bulk check: which students already have an invoice for this config?
      const studentIds = students.map((s: { id: string }) => s.id);
      const alreadyInvoiced = await this.repo.findExistingInvoiceStudentIds(studentIds, config.id, tx);

      // Count invoices once — increment in memory for serial generation
      let invCount = await this.repo.countInvoices(tx);
      let generatedCount = 0;

      for (const student of students) {
        if (alreadyInvoiced.has(student.id)) continue;

        const invoiceNo = generateSerial(`INV-${sectionId.toUpperCase().replace(/-/g, '')}`, invCount, 4);
        invCount++;

        await this.repo.createInvoice({
          invoiceNo,
          studentId: student.id,
          description: `Term Fees - ${new Date().toLocaleDateString()}`,
          amount: totalFeeAmount,
          dueDate: config.dueDate,
          status: "UNPAID",
          configId: config.id,
        }, tx);

        await this.repo.upsertBillingLedger(student.id, sectionId, totalFeeAmount, tx);
        generatedCount++;
      }

      if (generatedCount === 0) {
        throw new AppError(400, `All ${students.length} students in ${sectionId} already have invoices for this fee configuration.`);
      }

      return {
        message: `Generated ${generatedCount} invoices for ${students.length} students in ${sectionId}.`,
        totalAmount: totalFeeAmount,
      };
    });
  }

  async getAllLedgers() {
    return await this.repo.findAllLedgerAccounts();
  }

  async getPaginatedLedgers(skip: number, take: number) {
    const [data, total] = await Promise.all([
      this.repo.findAllLedgerAccounts(skip, take),
      this.repo.countLedgerAccounts(),
    ]);
    return { data, total };
  }

  async createLedger(data: { code: string; accountName: string; category: string; amount: string; type: "debit" | "credit" }) {
    return await this.repo.createLedgerAccount({
      code: data.code,
      accountName: data.accountName,
      category: data.category,
      debit: data.type === "debit" ? parseFloat(data.amount) : 0,
      credit: data.type === "credit" ? parseFloat(data.amount) : 0,
    });
  }

  private mapStaffPayrollRow(p: StaffPayrollRow) {
    return {
      id: p.id,
      name: p.staff.staffName,
      role: p.staff.account?.role || "General Staff",
      baseSalary: parseFloat(p.baseSalary.toString()),
      allowances: 0,
      deductions: parseFloat(p.deductions.toString()),
      status: p.salaryStatus === "DISBURSED" ? "Disbursed" as const : "Pending" as const
    };
  }

  private mapTeacherPayrollRow(p: TeacherPayrollRow) {
    return {
      id: p.id,
      name: p.teacher.teacherName,
      role: p.teacher.subject || "Faculty",
      baseSalary: parseFloat(p.baseSalary.toString()),
      allowances: 0,
      deductions: parseFloat(p.deductions.toString()),
      status: p.salaryStatus === "DISBURSED" ? "Disbursed" as const : "Pending" as const
    };
  }

  async getCombinedPayroll() {
    const staffPayroll = (await this.repo.getAllStaffPayroll()) as StaffPayrollRow[];
    const teacherPayroll = (await this.repo.getAllTeacherPayroll()) as TeacherPayrollRow[];

    return [
      ...staffPayroll.map((p) => this.mapStaffPayrollRow(p)),
      ...teacherPayroll.map((p) => this.mapTeacherPayrollRow(p)),
    ];
  }

  async getPaginatedPayroll(skip: number, take: number) {
    const [staffCount, teacherCount] = await Promise.all([
      this.repo.countStaffPayroll(),
      this.repo.countTeacherPayroll(),
    ]);
    const total = staffCount + teacherCount;

    // Over-fetch from each table to cover the requested page window,
    // then merge in memory and slice to exact boundaries.
    // This fetches at most (skip+take)*2 records instead of ALL records.
    const fetchLimit = skip + take;
    const [staffPayroll, teacherPayroll] = await Promise.all([
      this.repo.getAllStaffPayroll(0, fetchLimit),
      this.repo.getAllTeacherPayroll(0, fetchLimit),
    ]);

    const merged = [
      ...(staffPayroll as StaffPayrollRow[]).map((p) => this.mapStaffPayrollRow(p)),
      ...(teacherPayroll as TeacherPayrollRow[]).map((p) => this.mapTeacherPayrollRow(p)),
    ];

    return {
      data: merged.slice(skip, skip + take),
      total,
    };
  }

  async disbursePayroll(id: string) {
    return await prisma.$transaction(async (tx) => {
      const staffRecord = await this.repo.findStaffPayrollById(id, tx);
      if (staffRecord) {
        await this.repo.disburseStaffPayroll(id, tx);
        return { success: true, type: "STAFF" };
      }

      const teacherRecord = await this.repo.findTeacherPayrollById(id, tx);
      if (teacherRecord) {
        await this.repo.disburseTeacherPayroll(id, tx);
        return { success: true, type: "TEACHER" };
      }

      throw new AppError(404, "Payroll record not found for disbursement.");
    });
  }

  async getPaginatedCollections(skip: number, take: number) {
    const [data, total] = await Promise.all([
      this.repo.findAllCollections(skip, take),
      this.repo.countAllCollections(),
    ]);
    return { data, total };
  }

  async getAllCollections() {
    return this.repo.findAllCollections();
  }

  async getPaginatedInvoices(skip: number, take: number) {
    const [data, total] = await Promise.all([
      this.repo.findAllInvoices(skip, take),
      this.repo.countAllInvoices(),
    ]);
    const mapped = data.map((inv: InvoiceRow) => ({
      id: inv.invoiceNo,
      studentId: inv.student?.studentId || "N/A",
      feeCategory: inv.description,
      totalAmount: parseFloat(inv.amount.toString()),
      paidAmount: parseFloat(inv.paidAmount.toString()),
      status: inv.status === "PAID" ? "Paid" : inv.status === "PARTIAL" ? "Partial" : "Overdue",
      issueDate: inv.createdAt.toISOString(),
      dueDate: inv.dueDate.toISOString(),
    }));
    return { data: mapped, total };
  }

  async getPaginatedExpenses(skip: number, take: number) {
    const [data, total] = await Promise.all([
      this.repo.findAllExpenses(skip, take),
      this.repo.countAllExpenses(),
    ]);
    const mapped = data.map((e: { expenseNo: string; vendorName: string; category: string; description: string; amount: { toString: () => string }; paymentMethod: string; status: string; expenseDate: Date }) => ({
      id: e.expenseNo,
      vendorName: e.vendorName,
      category: e.category,
      description: e.description,
      amount: parseFloat(e.amount.toString()),
      paymentMethod: e.paymentMethod,
      status: e.status === "CLEARED" ? "Cleared" : e.status === "REJECTED" ? "Rejected" : "Pending_Approval",
      expenseDate: e.expenseDate.toISOString(),
    }));
    return { data: mapped, total };
  }

  async getAllExpenses() {
    const data = await this.repo.findAllExpenses();
    return data.map((e: { expenseNo: string; vendorName: string; category: string; description: string; amount: { toString: () => string }; paymentMethod: string; status: string; expenseDate: Date }) => ({
      id: e.expenseNo,
      vendorName: e.vendorName,
      category: e.category,
      description: e.description,
      amount: parseFloat(e.amount.toString()),
      paymentMethod: e.paymentMethod,
      status: e.status === "CLEARED" ? "Cleared" : e.status === "REJECTED" ? "Rejected" : "Pending_Approval",
      expenseDate: e.expenseDate.toISOString(),
    }));
  }

  async createExpense(data: Record<string, unknown>) {
    const count = await this.repo.countAllExpenses();
    const expenseNo = `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
    return this.repo.createExpense({ ...data, expenseNo });
  }

  async getAllInvoices() {
    const data = await this.repo.findAllInvoices();
    return data.map((inv: InvoiceRow) => ({
      id: inv.invoiceNo,
      studentId: inv.student?.studentId || "N/A",
      feeCategory: inv.description,
      totalAmount: parseFloat(inv.amount.toString()),
      paidAmount: parseFloat(inv.paidAmount.toString()),
      status: inv.status === "PAID" ? "Paid" : inv.status === "PARTIAL" ? "Partial" : "Overdue",
      issueDate: inv.createdAt.toISOString(),
      dueDate: inv.dueDate.toISOString(),
    }));
  }
}