import { Router } from 'express';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinanceRepository } from './finance.repository';
import { validate } from '@/middleware/validate';
import { requireRole, ROLES } from '@/middleware/rbac.middleware';
import { saveFeeMatrixSchema, commitInflowSchema, generateInvoicesSchema, createLedgerSchema, disbursePayrollSchema } from './finance.validation';

const router = Router();

// ── DEPENDENCY WIRING ──
const financeRepo = new FinanceRepository();
const financeService = new FinanceService(financeRepo);
const controller = new FinanceController(financeService);

// ── P0 FIX: All finance routes now require ADMIN or ACCOUNTANT role.
//    Previously, any authenticated user (including STUDENT) could
//    disburse payroll, generate invoices, and overwrite fee structures.
const financeAccess = requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT);

// --- FEE STRUCTURE CONFIGURATIONS ---
router.get('/fee-structures', financeAccess, controller.getGlobalFeeMatrix);
router.post('/fee-structures', financeAccess, validate(saveFeeMatrixSchema), controller.saveFeeMatrix);

// --- PAYMENTS INFLOW COLLECTIONS ---
router.get('/collections', financeAccess, controller.getCollections);
router.get('/collections/:sectionId', financeAccess, controller.getSectionLedger);
router.post('/collections', financeAccess, validate(commitInflowSchema), controller.commitInflow);

// --- STUDENT MONEY FLOW ---
router.get('/students-by-section/:sectionId', financeAccess, controller.getStudentsBySection);
router.post('/generate-invoices', financeAccess, validate(generateInvoicesSchema), controller.generateInvoices);

// --- INVOICES ---
router.get('/invoices', financeAccess, controller.getInvoices);

// --- PAYROLL & LEDGERS ---
router.get('/ledgers', financeAccess, controller.getLedgers);
router.post('/ledgers', financeAccess, validate(createLedgerSchema), controller.createLedger);
router.get('/payroll', financeAccess, controller.getPayroll);
router.patch('/payroll', financeAccess, validate(disbursePayrollSchema), controller.disbursePayroll);

export default router;
