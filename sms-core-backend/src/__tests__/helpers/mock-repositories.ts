import { vi } from 'vitest';
import type {
  IStudentRepository,
  ITeacherRepository,
  IStaffRepository,
  IFinanceRepository,
  IGradesRepository,
  IAttendanceRepository,
  TransactionClient,
} from '@/types/repositories';

/**
 * Creates a mock IStudentRepository with all methods as vi.fn().
 * Pass overrides to replace specific methods with custom implementations.
 */
export function createMockStudentRepo(overrides?: Partial<IStudentRepository>): IStudentRepository {
  return {
    findAll: vi.fn(),
    count: vi.fn(),
    findAllFiltered: vi.fn(),
    countFiltered: vi.fn(),
    findById: vi.fn(),
    findWithFinancialData: vi.fn(),
    findByPublicId: vi.fn(),
    createNestedStudent: vi.fn(),
    createDepartureLog: vi.fn(),
    updateStatus: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock ITeacherRepository with all methods as vi.fn().
 */
export function createMockTeacherRepo(overrides?: Partial<ITeacherRepository>): ITeacherRepository {
  return {
    findAllActive: vi.fn(),
    countActive: vi.fn(),
    findAllFiltered: vi.fn(),
    countFiltered: vi.fn(),
    findById: vi.fn(),
    findByPublicId: vi.fn(),
    createNestedTeacher: vi.fn(),
    createDepartureLog: vi.fn(),
    updateStatus: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock IStaffRepository with all methods as vi.fn().
 */
export function createMockStaffRepo(overrides?: Partial<IStaffRepository>): IStaffRepository {
  return {
    findAllActive: vi.fn(),
    countActive: vi.fn(),
    findAllFiltered: vi.fn(),
    countFiltered: vi.fn(),
    findById: vi.fn(),
    findByPublicId: vi.fn(),
    createNestedStaff: vi.fn(),
    createDepartureLog: vi.fn(),
    updateStatus: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock IFinanceRepository with all methods as vi.fn().
 */
export function createMockFinanceRepo(overrides?: Partial<IFinanceRepository>): IFinanceRepository {
  return {
    // Fee structures
    findAllFeeConfigurations: vi.fn(),
    findFeeConfigBySection: vi.fn(),
    deleteFeeConfigBySection: vi.fn(),
    createFeeConfig: vi.fn(),
    // Payment collections
    findCollectionsBySection: vi.fn(),
    findCollectionsBySectionPaginated: vi.fn(),
    countCollectionsBySection: vi.fn(),
    countCollections: vi.fn(),
    createCollection: vi.fn(),
    // Student financials
    findStudentsBySection: vi.fn(),
    findStudentsMinimalBySection: vi.fn(),
    findExistingInvoice: vi.fn(),
    countInvoices: vi.fn(),
    createInvoice: vi.fn(),
    findOldestUnpaidInvoice: vi.fn(),
    markInvoicePaid: vi.fn(),
    decrementBillingLedger: vi.fn(),
    upsertBillingLedger: vi.fn(),
    countStudentPayments: vi.fn(),
    createStudentPayment: vi.fn(),
    // General ledger & payroll
    findAllLedgerAccounts: vi.fn(),
    countLedgerAccounts: vi.fn(),
    createLedgerAccount: vi.fn(),
    getAllStaffPayroll: vi.fn(),
    getAllTeacherPayroll: vi.fn(),
    countStaffPayroll: vi.fn(),
    countTeacherPayroll: vi.fn(),
    findStaffPayrollById: vi.fn(),
    disburseStaffPayroll: vi.fn(),
    findTeacherPayrollById: vi.fn(),
    disburseTeacherPayroll: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock IGradesRepository with all methods as vi.fn().
 */
export function createMockGradesRepo(overrides?: Partial<IGradesRepository>): IGradesRepository {
  return {
    upsertGradeRecord: vi.fn(),
    getAllStudentGrades: vi.fn(),
    updateStudentGpa: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock IAttendanceRepository with all methods as vi.fn().
 */
export function createMockAttendanceRepo(overrides?: Partial<IAttendanceRepository>): IAttendanceRepository {
  return {
    recordBulkAttendance: vi.fn(),
    getStudentAttendanceCounts: vi.fn(),
    updateStudentAttendanceRate: vi.fn(),
    ...overrides,
  };
}
