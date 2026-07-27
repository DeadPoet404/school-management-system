import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { requireRole, ROLES } from '@/middleware/rbac.middleware';

const router = Router();
const controller = new AnalyticsController();

const dashboardAccess = requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF);

router.get('/dashboard', dashboardAccess, controller.getDashboard);

export default router;
