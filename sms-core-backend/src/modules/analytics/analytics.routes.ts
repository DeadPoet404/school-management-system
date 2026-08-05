import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { requireRole, ROLES } from '@/middleware/rbac.middleware';

const router = Router();
const controller = new AnalyticsController();

const dashboardAccess = requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF);

router.get('/dashboard', dashboardAccess, controller.getDashboard);


// SMS-011: granular per-widget aggregations (docs/DASHBOARD_DATA_API.md)
router.get('/collections-by-channel', dashboardAccess, controller.getCollectionsByChannel);
router.get('/expense-breakdown', dashboardAccess, controller.getExpenseBreakdown);
router.get('/receivables-aging', dashboardAccess, controller.getReceivablesAging);
router.get('/attendance-by-class', dashboardAccess, controller.getAttendanceByClass);
router.get('/enrollment-distribution', dashboardAccess, controller.getEnrollmentDistribution);
router.get('/academic-performance', dashboardAccess, controller.getAcademicPerformance);
router.get('/payroll-summary', dashboardAccess, controller.getPayrollSummary);
router.get('/top-debtors', dashboardAccess, controller.getTopDebtors);
router.get('/activity-feed', dashboardAccess, controller.getActivityFeed);

export default router;
