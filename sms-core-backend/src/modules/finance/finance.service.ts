import { prisma } from "@/lib/prisma";
import { parseDecimal, generateSerial } from "@/utils";
import { FinanceRepository } from "./finance.repository"; // NEW

export class FinanceService {
  private repo = new FinanceRepository(); // NEW

  /**
   * EXISTING: Reads all fee matrix structures.
   */
  async getGlobalMatrix(): Promise<Record<string, any>> {
    // ✅ Delegated to repo
    const records = await this.repo.findAllFeeConfigurations();

    const matrix: Record<string, any> = {};

    records.forEach((rec: any) => {
      matrix[rec.sectionId] = {
        components: rec.components.map((c: any) => ({
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

  /**
   * EXISTING: Safely overwrites the entire fee matrix.
   */
  async replaceGlobalMatrix(matrixData: Record<string, any>): Promise<void> {
    // Service maintains transaction boundary
    await prisma.$transaction(async (tx) => {
      for (const [sectionId, sectionData] of Object.entries(matrixData)) {
        const { components, billingConfig } = sectionData as any;

        // ✅ Delegated to repo (passing tx)
        await this.repo.deleteFeeConfigBySection(sectionId as string, tx);

        // ✅ Delegated to repo (passing tx)
        await this.repo.createFeeConfig({
          sectionId: sectionId as string,
          issueDate: billingConfig.issueDate ? new Date(billingConfig.issueDate) : new Date(),
          dueDate: billingConfig.dueDate ? new Date(billingConfig.dueDate) : new Date(),
          allowInstallments: !!billingConfig.allowInstallments,
          lateFeeRate: String(billingConfig.lateFeeRate || '0'),
          components: {
            create: components.map((c: any) => ({
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

  /**
   * EXISTING: Fetches inflow payment ledger history.
   */
  async getInflowLedgerBySection(sectionId: string) {
    // ✅ Delegated to repo
    return await this.repo.findCollectionsBySection(sectionId);
  }

  /**
   * UPGRADED: Processes a transaction inflow atomically.
   * NOW SUPPORTS: Smart routing if studentInternalId is provided.
   * FALLS BACK TO: Dumb logging if only studentName is provided (Old behavior).
   */
  async processInflowCollection(data: {
    sectionId: string;
    studentName: string;
    amountPaid: string;
    paymentMethod: string;
    referenceNo?: string;
    allocationTarget: string;
    studentInternalId?: string; // NEW: Optional UUID
  }) {
    // Service maintains transaction boundary
    return await prisma.$transaction(async (tx) => {
      // ✅ Delegated to repo
      const count = await this.repo.countCollections(tx);
      const uniqueSerial = generateSerial('REC-2026', count);
      
      // ✅ Delegated to repo
      const collectionRecord = await this.repo.createCollection({
        receiptNumber: uniqueSerial,
        sectionId: data.sectionId,
        studentName: data.studentName,
        amountPaid: data.amountPaid,
        paymentMethod: data.paymentMethod,
        referenceNo: data.referenceNo || 'N/A (Direct)',
        allocationTarget: data.allocationTarget,
        // FIX: Only include the key if the UUID is actually provided
        ...(data.studentInternalId ? { studentInternalId: data.studentInternalId } : {}),
      }, tx);

      // 2. SMART ROUTING: If UUID is provided, execute real accounting
      if (data.studentInternalId) {
        const numericAmount = parseDecimal(data.amountPaid);
        
        // ✅ Delegated to repo
        await this.repo.decrementBillingLedger(data.studentInternalId, numericAmount, tx);

        // ✅ Delegated to repo
        const paymentCount = await this.repo.countStudentPayments(tx);
        const paymentReceiptNo = generateSerial('PAY-2026', paymentCount);

        // ✅ Delegated to repo
        await this.repo.createStudentPayment({
          receiptNo: paymentReceiptNo, // Use independent receipt number
          studentId: data.studentInternalId,
          description: `${data.allocationTarget} - ${data.paymentMethod}`,
          amount: numericAmount,
          paymentType: data.paymentMethod,
        }, tx);

        // ✅ Delegated to repo
        const unpaidInvoice = await this.repo.findOldestUnpaidInvoice(data.studentInternalId, tx);

        if (unpaidInvoice && numericAmount >= parseDecimal(unpaidInvoice.amount)) {
          // ✅ Delegated to repo
          await this.repo.markInvoicePaid(unpaidInvoice.id, tx);
        }
      }

      return collectionRecord;
    });
  }

  // =========================================================================
  // NEW ENDPOINTS: STUDENT MONEY FLOW
  // =========================================================================

  /**
   * NEW: Fetches real students for a section to populate the Cashier dropdown.
   */
  async getStudentsBySection(sectionId: string) {
    // ✅ Delegated to repo
    return await this.repo.findStudentsBySection(sectionId);
  }

  /**
   * NEW: Generates actual Invoice records for all students in a section
   * based on the FeeStructureConfiguration rules.
   */
  async generateInvoicesForSection(sectionId: string) {
    // ✅ Delegated to repo
    const config = await this.repo.findFeeConfigBySection(sectionId);

    if (!config) {
      throw new Error(`No fee configuration found for section: ${sectionId}`);
    }

    // ✅ Delegated to repo
    const students = await this.repo.findStudentsMinimalBySection(sectionId);

    if (students.length === 0) {
      throw new Error(`No active students found in section: ${sectionId}`);
    }

    // Calculate total fee from components
    // ✅ NEW (Explicitly typed parameters)
const totalFeeAmount = (config.components as any[]).reduce((sum: number, comp: any) => sum + parseDecimal(comp.amount), 0);
    let generatedCount = 0;

    // Service maintains transaction boundary
    await prisma.$transaction(async (tx) => {
      for (const student of students) {
        // ✅ Delegated to repo
        const existingInvoice = await this.repo.findExistingInvoice(student.id, config.id, tx);

        if (!existingInvoice) {
          // ✅ Delegated to repo
          const invCount = await this.repo.countInvoices(tx);
          const invoiceNo = generateSerial(
            `INV-${sectionId.toUpperCase().replace(/-/g, '')}`, 
            invCount, 
            4, 
            1 
          );

          // ✅ Delegated to repo
          await this.repo.createInvoice({
            invoiceNo,
            studentId: student.id,
            description: `Term Fees - ${new Date().toLocaleDateString()}`,
            amount: totalFeeAmount,
            dueDate: config.dueDate,
            status: "UNPAID",
            configId: config.id
          }, tx);

          // ✅ Delegated to repo
          await this.repo.upsertBillingLedger(student.id, sectionId, totalFeeAmount, tx);
          
          generatedCount++;
        }
      }
    });

    return { 
      message: `Generated ${generatedCount} invoices for ${students.length} students in ${sectionId}.`,
      totalAmount: totalFeeAmount 
    };
  }

    // =========================================================================
  // PAYROLL & LEDGER ENDPOINTS
  // =========================================================================

  /**
   * FETCH ALL LEDGER ACCOUNTS
   */
  async getAllLedgers() {
    // ✅ Delegated to repo
    return await this.repo.findAllLedgerAccounts();
  }

  /**
   * CREATE A NEW LEDGER ACCOUNT
   */
  async createLedger(data: { code: string; accountName: string; category: string; amount: string; type: "debit" | "credit" }) {
    // ✅ Delegated to repo (No tx needed, single operation)
    return await this.repo.createLedgerAccount({
      code: data.code,
      accountName: data.accountName,
      category: data.category,
      // If type is debit, put amount in debit column, else credit column
      debit: data.type === "debit" ? parseFloat(data.amount) : 0,
      credit: data.type === "credit" ? parseFloat(data.amount) : 0,
    });
  }

  /**
   * GET COMBINED PAYROLL (Staff + Teachers)
   */
  async getCombinedPayroll() {
    // ✅ Delegated to repo
    const staffPayroll = await this.repo.getAllStaffPayroll();

    // ✅ Delegated to repo
    const teacherPayroll = await this.repo.getAllTeacherPayroll();

    // 3. Map Staff to unified frontend shape
    const staffMapped = staffPayroll.map((p: any) => ({
      id: p.id,
      name: p.staff.staffName,
      role: p.staff.account?.role || "General Staff",
      baseSalary: parseFloat(p.baseSalary.toString()),
      allowances: 0, // Defaulting to 0 until schema is updated
      deductions: parseFloat(p.deductions.toString()),
      status: p.salaryStatus === "DISBURSED" ? "Disbursed" as const : "Pending" as const
    }));

    // 4. Map Teachers to unified frontend shape
    const teacherMapped = teacherPayroll.map((p: any) => ({
      id: p.id,
      name: p.teacher.teacherName,
      role: p.teacher.subject || "Faculty",
      baseSalary: parseFloat(p.baseSalary.toString()),
      allowances: 0, // Defaulting to 0 until schema is updated
      deductions: parseFloat(p.deductions.toString()),
      status: p.salaryStatus === "DISBURSED" ? "Disbursed" as const : "Pending" as const
    }));

    // 5. Combine and return
    return [...staffMapped, ...teacherMapped];
  }

   /**
   * DISBURSE PAYROLL (Finds record by ID across both tables)
   */
  async disbursePayroll(id: string) {
    // Service maintains transaction boundary
    return await prisma.$transaction(async (tx) => {
      // ✅ Delegated to repo
      const staffRecord = await this.repo.findStaffPayrollById(id, tx);

      if (staffRecord) {
        // ✅ Delegated to repo
        await this.repo.disburseStaffPayroll(id, tx);
        return { success: true, type: "STAFF" };
      }

      // ✅ Delegated to repo
      const teacherRecord = await this.repo.findTeacherPayrollById(id, tx);

      if (teacherRecord) {
        // ✅ Delegated to repo
        await this.repo.disburseTeacherPayroll(id, tx);
        return { success: true, type: "TEACHER" };
      }

      throw new Error("Payroll record not found for disbursement.");
    });
  }
}