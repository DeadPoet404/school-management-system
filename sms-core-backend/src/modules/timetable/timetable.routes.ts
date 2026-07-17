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

router.get("/matrix", controller.getMatrix);
// ── P0 FIX: POST /matrix was previously accessible to any authenticated user
//    (including STUDENT). It replaces the entire global timetable.
router.post("/matrix", requireRole(ROLES.ADMIN), validate(saveMatrixSchema), controller.saveMatrix);

export default router;
