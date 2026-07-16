import { Router } from "express";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";
import { validate } from "@/middleware/validate";
import { submitSectionAttendanceSchema } from "./attendance.validation";

const router = Router();

// ── DEPENDENCY WIRING ──
const attendanceService = new AttendanceService();
const controller = new AttendanceController(attendanceService);

router.post("/section", validate(submitSectionAttendanceSchema), controller.submitSectionAttendance);

export default router;
