import { Router } from 'express';
import { CommunicationController } from './communication.controller';
import { requireRole, ROLES } from '@/middleware/rbac.middleware';
import { validate } from '@/middleware/validate';
import { composeAnnouncementSchema } from './communication.validation';

const router = Router();
const controller = new CommunicationController();

// SMS-012: ADMIN composes/sends; STAFF reads the delivery ledger.
const composeAccess = requireRole(ROLES.ADMIN);
const readAccess = requireRole(ROLES.ADMIN, ROLES.STAFF);

router.post('/announcements', composeAccess, validate(composeAnnouncementSchema), controller.compose);
router.get('/announcements', readAccess, controller.list);
router.get('/announcements/:id/deliveries', readAccess, controller.deliveries);

export default router;
