import { Router } from 'express';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinanceRepository } from './finance.repository';
import { validate } from '@/middleware/validate';
import { requireRole, ROLES } from '@/middleware/rbac.middleware';
import { saveFeeMatrixSchema, commitInflowSchema, generateInvoicesSchema, createLedgerSchema, disbursePayrollSchema } from './finance.validation';
import { createExpenseSchema } from './expense.validation';

const router = Router();

const financeRepo = new FinanceRepository();
const financeService = new FinanceService(financeRepo);
const controller = new FinanceController(financeService);
const financeAccess = requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT);

router.get('/dashboard', financeAccess, controller.getDashboard);
router.get('/fee-structures', financeAccess, controller.getGlobalFeeMatrix);
router.post('/fee-structures', financeAccess, validate(saveFeeMatrixSchema), controller.saveFeeMatrix);

router.get('/collections', financeAccess, controller.getCollections);
router.get('/collections/:sectionId', financeAccess, controller.getSectionLedger);
router.post('/collections', financeAccess, validate(commitInflowSchema), controller.commitInflow);

router.get('/students-by-section/:sectionId', financeAccess, controller.getStudentsBySection);
router.post('/generate-invoices', financeAccess, validate(generateInvoicesSchema), controller.generateInvoices);

router.get('/invoices', financeAccess, controller.getInvoices);

router.get('/expenses', financeAccess, controller.getExpenses);
router.post('/expenses', financeAccess, validate(createExpenseSchema), controller.createExpense);

router.get('/ledgers', financeAccess, controller.getLedgers);
router.post('/ledgers', financeAccess, validate(createLedgerSchema), controller.createLedger);
router.get('/payroll', financeAccess, controller.getPayroll);
router.patch('/payroll', financeAccess, validate(disbursePayrollSchema), controller.disbursePayroll);

export default router;
