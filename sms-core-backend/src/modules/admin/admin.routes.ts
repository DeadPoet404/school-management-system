import { Router } from "express";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { authenticate } from "@/middleware/auth.middleware";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";
import { validate } from "@/middleware/validate";
import { institutionUpdateSchema, dataWipeSchema } from "./admin.validation";

const router = Router();

// ── DEPENDENCY WIRING ──
const adminService = new AdminService();
const adminController = new AdminController(adminService);

// Every route in this module is admin-only.
router.use(authenticate, requireRole(ROLES.ADMIN));

// Institution profile (read + edit, incl. currency).
router.get("/institution", adminController.getInstitution);
router.put("/institution", validate(institutionUpdateSchema), adminController.updateInstitution);

// Data hygiene: summary, guarded wipe, audit trail.
router.get("/data/summary", adminController.getDataSummary);
router.post("/data/wipe", validate(dataWipeSchema), adminController.wipeData);
router.get("/audit", adminController.getAuditLog);

export default router;
