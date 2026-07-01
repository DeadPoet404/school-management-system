import { Router } from 'express';
import { FinanceController } from './finance.controller';

const router = Router();
const controller = new FinanceController();

// --- FEE STRUCTURE CONFIGURATIONS (Existing) ---
router.get('/fee-structures', controller.getGlobalFeeMatrix);
router.post('/fee-structures', controller.saveFeeMatrix);

// --- PAYMENTS INFLOW COLLECTIONS (Existing - now smart behind the scenes!) ---
router.get('/collections/:sectionId', controller.getSectionLedger);
router.post('/collections', controller.commitInflow);

// --- NEW: STUDENT MONEY FLOW ---
router.get('/students-by-section/:sectionId', controller.getStudentsBySection);
router.post('/generate-invoices', controller.generateInvoices);

// --- NEW: PAYROLL & LEDGERS ---
router.get('/ledgers', controller.getLedgers);
router.post('/ledgers', controller.createLedger);
router.get('/payroll', controller.getPayroll);
router.patch('/payroll', controller.disbursePayroll);

export default router;

    