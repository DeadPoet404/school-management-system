import { Router } from "express";
import { TimetableController } from "./timetable.controller";
import { TimetableService } from "./timetable.service";
import { validate } from "@/middleware/validate";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";
import { saveMatrixSchema } from "./timetable.validation";

const router = Router();

// ── DEPENDENCY WIRING ──
const timetableService = new TimetableService();
const controller = new TimetableController(timetableService);

router.get("/matrix", requireRole(ROLES.STUDENT, ROLES.STAFF, ROLES.FACULTY, ROLES.ADMIN), controller.getMatrix);
router.post("/matrix", requireRole(ROLES.STAFF, ROLES.ADMIN), validate(saveMatrixSchema), controller.saveMatrix);

export default router;
