import { Router } from "express";
import { AttendanceController } from "./attendance.controller";

const router = Router();
const controller = new AttendanceController();

// Specialized high-density matrix intake endpoint
router.post("/section", controller.submitSectionAttendance);

export default router;