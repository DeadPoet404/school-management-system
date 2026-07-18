import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDecimal, generateSerial } from "@/utils";
import { IFinanceRepository } from "@/types/repositories";
import { FinanceRepository } from "./finance.repository";

type FeeConfigRow = Prisma.FeeStructureConfigurationGetPayload<{ include: { components: true } }>;
type StaffPayrollRow = Prisma.StaffPayrollGetPayload<{ include: { staff: { select: { staffName: true; account: { select: { role: true } } } } } }>;
type TeacherPayrollRow = Prisma.TeacherPayrollGetPayload<{ include: { teacher: { select: { teacherName: true; subject: true } } } }>;

interface MatrixSectionData {
  components: Array<{ name?: string; amount?: string | number; frequency?: string; isMandatory?: boolean }>;
  billingConfig: { issueDate?: string | Date; dueDate?: string | Date; allowInstallments?: boolean; lateFeeRate?: string | number };
}

export class FinanceService {
  constructor(private repo: IFinanceRepository = new FinanceRepository()) {}

  async getGlobalMatrix(): Promise<Record<string, any>> {
    const records = (await this.repo.findAllFeeConfigurations()) as FeeConfigRow[];
    const matrix: Record<string, any> = {};

    records.forEach((rec) => {
      matrix[rec.sectionId] = {
        components: rec.components.map((c) => ({
          id: c.id,
          name: c.name,
          amount: c.amount,
          frequency: c.frequency,
          isMandatory: c.isMandatory,
        })),
        billingConfig: {
          issueDate: rec.issueDate,
          dueDate: rec.dueDate,
          allowInstallments: rec.allowInstallments,
          lateFeeRate: rec.lateFeeRate,
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
      const uniqueSerial = generateSerial('REC-2026', count);
      
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
        const paymentReceiptNo = generateSerial('PAY-2026', paymentCount);

        await this.repo.createStudentPayment({
          receiptNo: paymentReceiptNo,
          studentId: data.studentInternalId,
          description: `${data.allocationTarget} - ${data.paymentMethod}`,
          amount: numericAmount,
          paymentType: data.paymentMethod,
        }, tx);

        const unpaidInvoice = await this.repo.findOldestUnpaidInvoice(data.studentInternalId, tx);
        if (unpaidInvoice && numericAmount >= parseDecimal(unpaidInvoice.amount)) {
          await this.repo.markInvoicePaid(unpaidInvoice.id, tx);
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
    if (!config) throw new Error(`No fee configuration found for section: ${sectionId}`);

    const students = await this.repo.findStudentsMinimalBySection(sectionId);
    if (students.length === 0) throw new Error(`No active students found in section: ${sectionId}`);

    const configTyped = config as FeeConfigRow;
    const totalFeeAmount = configTyped.components.reduce((sum, comp) => sum + parseDecimal(String(comp.amount)), 0);
    let generatedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const student of students) {
        const existingInvoice = await this.repo.findExistingInvoice(student.id, config.id, tx);
        if (!existingInvoice) {
          const invCount = await this.repo.countInvoices(tx);
          const invoiceNo = generateSerial(`INV-${sectionId.toUpperCase().replace(/-/g, '')}`, invCount, 4);

          await this.repo.createInvoice({
            invoiceNo,
            studentId: student.id,
            description: `Term Fees - ${new Date().toLocaleDateString()}`,
            amount: totalFeeAmount,
            dueDate: config.dueDate,
            status: "UNPAID",
            configId: config.id
          }, tx);

          await this.repo.upsertBillingLedger(student.id, sectionId, totalFeeAmount, tx);
          generatedCount++;
        }
      }
    });

    return { message: `Generated ${generatedCount} invoices for ${students.length} students in ${sectionId}.`, totalAmount: totalFeeAmount };
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

      throw new Error("Payroll record not found for disbursement.");
    });
  }
}
