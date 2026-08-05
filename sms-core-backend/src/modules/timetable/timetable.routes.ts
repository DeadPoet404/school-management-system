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

// SMS-005: session-resolved class schedule for the portal.
router.get("/me", requireRole(ROLES.STUDENT), controller.getOwnTimetable);

router.get("/matrix", requireRole(ROLES.ADMIN, ROLES.FACULTY), controller.getMatrix);

// SMS-010: mint signed .ics subscription links (feed itself is public + token-gated)
router.post("/calendar/:classId/token", requireRole(ROLES.ADMIN, ROLES.FACULTY), controller.mintCalendarToken);
router.post("/matrix", requireRole(ROLES.ADMIN), validate(saveMatrixSchema), controller.saveMatrix);

export default router;
