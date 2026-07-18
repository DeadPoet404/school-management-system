import { Router } from "express";
import { TimetableController } from "./timetable.controller";
import { TimetableService } from "./timetable.service";
import { TimetableRepository } from "./timetable.repository";
import { validate } from "@/middleware/validate";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";
import { saveMatrixSchema } from "./timetable.validation";

const router = Router();

// ── DEPENDENCY WIRING ──
const timetableRepo = new TimetableRepository();
const timetableService = new TimetableService(timetableRepo);
const controller = new TimetableController(timetableService);

router.get("/matrix", requireRole(ROLES.ADMIN), controller.getMatrix);
router.post("/matrix", requireRole(ROLES.ADMIN), validate(saveMatrixSchema), controller.saveMatrix);

export default router;
