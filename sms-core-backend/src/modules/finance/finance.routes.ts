import { Router } from 'express';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinanceRepository } from './finance.repository';
import { validate } from '@/middleware/validate';
import { saveFeeMatrixSchema, commitInflowSchema, generateInvoicesSchema, createLedgerSchema, disbursePayrollSchema } from './finance.validation';

const router = Router();

// ── DEPENDENCY WIRING ──
const financeRepo = new FinanceRepository();
const financeService = new FinanceService(financeRepo);
const controller = new FinanceController(financeService);

// --- FEE STRUCTURE CONFIGURATIONS ---
router.get('/fee-structures', controller.getGlobalFeeMatrix);
router.post('/fee-structures', validate(saveFeeMatrixSchema), controller.saveFeeMatrix);

// --- PAYMENTS INFLOW COLLECTIONS ---
router.get('/collections/:sectionId', controller.getSectionLedger);
router.post('/collections', validate(commitInflowSchema), controller.commitInflow);

// --- STUDENT MONEY FLOW ---
router.get('/students-by-section/:sectionId', controller.getStudentsBySection);
router.post('/generate-invoices', validate(generateInvoicesSchema), controller.generateInvoices);

// --- PAYROLL & LEDGERS ---
router.get('/ledgers', controller.getLedgers);
router.post('/ledgers', validate(createLedgerSchema), controller.createLedger);
router.get('/payroll', controller.getPayroll);
router.patch('/payroll', validate(disbursePayrollSchema), controller.disbursePayroll);

export default router;
