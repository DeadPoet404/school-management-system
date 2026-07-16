import { Router } from "express";
import { TimetableController } from "./timetable.controller";
import { TimetableService } from "./timetable.service";
import { validate } from "@/middleware/validate";
import { saveMatrixSchema } from "./timetable.validation";

const router = Router();

// ── DEPENDENCY WIRING ──
const timetableService = new TimetableService();
const controller = new TimetableController(timetableService);

router.get("/matrix", controller.getMatrix);
router.post("/matrix", validate(saveMatrixSchema), controller.saveMatrix);

export default router;
