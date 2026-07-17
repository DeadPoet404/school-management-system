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

// --- FEE STRUCTURE CONFIGURATIONS ---
router.get('/fee-structures', requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getGlobalFeeMatrix);
router.post('/fee-structures', requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT), validate(saveFeeMatrixSchema), controller.saveFeeMatrix);

// --- PAYMENTS INFLOW COLLECTIONS ---
router.get('/collections/:sectionId', requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getSectionLedger);
router.post('/collections', requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.ACCOUNTANT), validate(commitInflowSchema), controller.commitInflow);

// --- STUDENT MONEY FLOW ---
router.get('/students-by-section/:sectionId', requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getStudentsBySection);
router.post('/generate-invoices', requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT), validate(generateInvoicesSchema), controller.generateInvoices);

// --- PAYROLL & LEDGERS ---
router.get('/ledgers', requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getLedgers);
router.post('/ledgers', requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT), validate(createLedgerSchema), controller.createLedger);
router.get('/payroll', requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getPayroll);
router.patch('/payroll', requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT), validate(disbursePayrollSchema), controller.disbursePayroll);

export default router;
