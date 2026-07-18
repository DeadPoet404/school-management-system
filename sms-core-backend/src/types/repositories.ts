import { Prisma, EntityStatus, DepartureType, InvoiceStatus, PersonnelDepartureType, TreasuryClearanceStatus } from "@prisma/client";

// ── Shared transaction client type ──
export type TransactionClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// ── Typed input interfaces for repository create/upsert methods ──
export interface GradeRecordUpsertData {
  studentId: string;
  subjectId: string;
  classId: string;
  termId: string;
  continuousAssessment: number;
  examination: number;
  finalScore: number;
  letterGrade: string;
  gradePoints: number;
  creditHours?: number;
}

export interface FeeConfigCreateData {
  sectionId: string;
  issueDate: Date;
  dueDate: Date;
  allowInstallments: boolean;
  lateFeeRate: string;
  components: {
    create: Array<{
      name: string;
      amount: string;
      frequency: string;
      isMandatory: boolean;
    }>;
  };
}

export interface CollectionCreateData {
  receiptNumber: string;
  sectionId: string;
  studentName: string;
  amountPaid: string;
  paymentMethod: string;
  referenceNo: string;
  allocationTarget: string;
  studentInternalId?: string;
}

export interface InvoiceCreateData {
  invoiceNo: string;
  studentId: string;
  description: string;
  amount: number;
  dueDate: Date;
  status: InvoiceStatus;
  configId: string;
}

export interface StudentPaymentCreateData {
  receiptNo: string;
  studentId: string;
  description: string;
  amount: number;
  paymentType: string;
}

export interface LedgerAccountCreateData {
  code: string;
  accountName: string;
  category: string;
  debit: number;
  credit: number;
}

export interface AttendanceRecordCreateData {
  studentId: string;
  date: Date;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  remarks?: string;
}

// ═══════════════════════════════════════════════════════════
// ── REPOSITORY INTERFACES ──
// Return types use `any` intentionally — Prisma's payload types
// are complex and consumed immediately by services. Input types
// are fully typed for compile-time safety.
// ═══════════════════════════════════════════════════════════

export interface IStudentRepository {
  findAll(skip?: number, take?: number, tx?: TransactionClient): Promise<any>;
  count(tx?: TransactionClient): Promise<number>;
  findAllFiltered(where: Prisma.StudentWhereInput, skip?: number, take?: number, tx?: TransactionClient): Promise<any>;
  countFiltered(where: Prisma.StudentWhereInput, tx?: TransactionClient): Promise<number>;
  findById(id: string, tx?: TransactionClient): Promise<any>;
  findWithFinancialData(tx?: TransactionClient): Promise<any>;
  findByPublicId(studentId: string, tx?: TransactionClient): Promise<any>;
  createNestedStudent(data: Prisma.StudentCreateInput, tx?: TransactionClient): Promise<any>;
  createDepartureLog(data: Prisma.StudentDepartureUncheckedCreateInput, tx?: TransactionClient): Promise<any>;
  updateStatus(id: string, status: EntityStatus, tx?: TransactionClient): Promise<any>;
update(id: string, data: any, tx?: TransactionClient): Promise<any>;
}

export interface ITeacherRepository {
  findAllActive(skip?: number, take?: number, tx?: TransactionClient): Promise<any>;
  countActive(tx?: TransactionClient): Promise<number>;
  findAllFiltered(where: Prisma.TeacherWhereInput, skip?: number, take?: number, tx?: TransactionClient): Promise<any>;
  countFiltered(where: Prisma.TeacherWhereInput, tx?: TransactionClient): Promise<number>;
  findByPublicId(teacherId: string, tx?: TransactionClient): Promise<any>;
  createNestedTeacher(data: Prisma.TeacherCreateInput, tx?: TransactionClient): Promise<any>;
  createDepartureLog(data: Prisma.TeacherDepartureUncheckedCreateInput, tx?: TransactionClient): Promise<any>;
  updateStatus(id: string, status: EntityStatus, tx?: TransactionClient): Promise<any>;
  findById(id: string, tx?: TransactionClient): Promise<any>;
  update(id: string, data: any, tx?: TransactionClient): Promise<any>;
}

export interface IStaffRepository {
  findAllActive(skip?: number, take?: number, tx?: TransactionClient): Promise<any>;
  countActive(tx?: TransactionClient): Promise<number>;
  findAllFiltered(where: Prisma.StaffWhereInput, skip?: number, take?: number, tx?: TransactionClient): Promise<any>;
  countFiltered(where: Prisma.StaffWhereInput, tx?: TransactionClient): Promise<number>;
  findByPublicId(staffId: string, tx?: TransactionClient): Promise<any>;
  createNestedStaff(data: Prisma.StaffCreateInput, tx?: TransactionClient): Promise<any>;
  createDepartureLog(data: Prisma.StaffDepartureUncheckedCreateInput, tx?: TransactionClient): Promise<any>;
  updateStatus(id: string, status: EntityStatus, tx?: TransactionClient): Promise<any>;
  findById(id: string, tx?: TransactionClient): Promise<any>;
  update(id: string, data: any, tx?: TransactionClient): Promise<any>;
}

export interface IGradesRepository {
  upsertGradeRecord(data: GradeRecordUpsertData, tx?: TransactionClient): Promise<any>;
  getAllStudentGrades(studentInternalId: string, tx?: TransactionClient): Promise<any>;
  updateStudentGpa(studentInternalId: string, gpa: number, tx?: TransactionClient): Promise<any>;
}

export interface IFinanceRepository {
  // Fee structures
  findAllFeeConfigurations(tx?: TransactionClient): Promise<any>;
  findFeeConfigBySection(sectionId: string, tx?: TransactionClient): Promise<any>;
  deleteFeeConfigBySection(sectionId: string, tx?: TransactionClient): Promise<any>;
  createFeeConfig(data: FeeConfigCreateData, tx?: TransactionClient): Promise<any>;
  // Payment collections
  findCollectionsBySection(sectionId: string, tx?: TransactionClient): Promise<any>;
  findCollectionsBySectionPaginated(sectionId: string, skip: number, take: number, tx?: TransactionClient): Promise<any>;
  countCollectionsBySection(sectionId: string, tx?: TransactionClient): Promise<any>;
  countCollections(tx?: TransactionClient): Promise<any>;
  createCollection(data: CollectionCreateData, tx?: TransactionClient): Promise<any>;
  // Student financials
  findStudentsBySection(sectionId: string, tx?: TransactionClient): Promise<any>;
  findStudentsMinimalBySection(sectionId: string, tx?: TransactionClient): Promise<any>;
  findExistingInvoice(studentId: string, configId: string, tx?: TransactionClient): Promise<any>;
  countInvoices(tx?: TransactionClient): Promise<any>;
  createInvoice(data: InvoiceCreateData, tx?: TransactionClient): Promise<any>;
  findOldestUnpaidInvoice(studentId: string, tx?: TransactionClient): Promise<any>;
  markInvoicePaid(invoiceId: string, tx?: TransactionClient): Promise<any>;
  decrementBillingLedger(studentId: string, amount: number, tx?: TransactionClient): Promise<any>;
  upsertBillingLedger(studentId: string, feeTierId: string, amount: number, tx?: TransactionClient): Promise<any>;
  countStudentPayments(tx?: TransactionClient): Promise<any>;
  createStudentPayment(data: StudentPaymentCreateData, tx?: TransactionClient): Promise<any>;
  // General ledger & payroll (with pagination support)
  findAllLedgerAccounts(skip?: number, take?: number, tx?: TransactionClient): Promise<any>;
  countLedgerAccounts(tx?: TransactionClient): Promise<number>;
  createLedgerAccount(data: LedgerAccountCreateData, tx?: TransactionClient): Promise<any>;
  getAllStaffPayroll(skip?: number, take?: number, tx?: TransactionClient): Promise<any>;
  getAllTeacherPayroll(skip?: number, take?: number, tx?: TransactionClient): Promise<any>;
  countStaffPayroll(tx?: TransactionClient): Promise<number>;
  countTeacherPayroll(tx?: TransactionClient): Promise<number>;
  findStaffPayrollById(id: string, tx?: TransactionClient): Promise<any>;
  disburseStaffPayroll(id: string, tx?: TransactionClient): Promise<any>;
  findTeacherPayrollById(id: string, tx?: TransactionClient): Promise<any>;
  disburseTeacherPayroll(id: string, tx?: TransactionClient): Promise<any>;
}

export interface IAttendanceRepository {
  recordBulkAttendance(records: AttendanceRecordCreateData[], tx?: TransactionClient): Promise<any>;
  getStudentAttendanceCounts(studentInternalId: string, tx?: TransactionClient): Promise<any>;
  updateStudentAttendanceRate(studentInternalId: string, rate: number, tx?: TransactionClient): Promise<any>;
}
