/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use any for flexibility */
import { vi } from 'vitest';
import type {
  IStudentRepository,
  ITeacherRepository,
  IStaffRepository,
  IFinanceRepository,
  IGradesRepository,
  IAttendanceRepository,
  ITimetableRepository,
  TransactionClient,
} from '@/types/repositories';

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

export function createMockFinanceRepo(overrides?: Partial<IFinanceRepository>): IFinanceRepository {
  return {
    findAllFeeConfigurations: vi.fn(),
    findFeeConfigBySection: vi.fn(),
    deleteFeeConfigBySection: vi.fn(),
    createFeeConfig: vi.fn(),
    findCollectionsBySection: vi.fn(),
    findCollectionsBySectionPaginated: vi.fn(),
    countCollectionsBySection: vi.fn(),
    countCollections: vi.fn(),
    findAllCollections: vi.fn(),
    countAllCollections: vi.fn(),
    createCollection: vi.fn(),
    findStudentsBySection: vi.fn(),
    findStudentsMinimalBySection: vi.fn(),
    findExistingInvoice: vi.fn(),
    findExistingInvoiceStudentIds: vi.fn().mockResolvedValue(new Set()),
    countInvoices: vi.fn(),
    createInvoice: vi.fn(),
    findOldestUnpaidInvoice: vi.fn(),
    markInvoicePaid: vi.fn(),
    applyPaymentToInvoice: vi.fn(),
    findAllInvoices: vi.fn(),
    countAllInvoices: vi.fn(),
    decrementBillingLedger: vi.fn(),
    upsertBillingLedger: vi.fn(),
    countStudentPayments: vi.fn(),
    createStudentPayment: vi.fn(),
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
    findAllExpenses: vi.fn(),
    countAllExpenses: vi.fn(),
    createExpense: vi.fn(),
    ...overrides,
  };
}

export function createMockGradesRepo(overrides?: Partial<IGradesRepository>): IGradesRepository {
  return {
    upsertGradeRecord: vi.fn(),
    getAllStudentGrades: vi.fn(),
    updateStudentGpa: vi.fn(),
    findTeacherAllocation: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

export function createMockAttendanceRepo(overrides?: Partial<IAttendanceRepository>): IAttendanceRepository {
  return {
    recordBulkAttendance: vi.fn(),
    getStudentAttendanceCounts: vi.fn(),
    updateStudentAttendanceRate: vi.fn(),
    ...overrides,
  };
}

export function createMockTimetableRepo(overrides?: Partial<ITimetableRepository>): ITimetableRepository {
  return {
    findAllConfigurations: vi.fn(),
    replaceSectionConfig: vi.fn(),
    ...overrides,
  };
}
