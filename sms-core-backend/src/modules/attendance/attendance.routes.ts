import { Router } from "express";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";
import { AttendanceRepository } from "./attendance.repository";
import { validate } from "@/middleware/validate";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";
import { submitSectionAttendanceSchema } from "./attendance.validation";

const router = Router();

const attendanceRepo = new AttendanceRepository();
const attendanceService = new AttendanceService(attendanceRepo);
const controller = new AttendanceController(attendanceService);

// Submit attendance (FACULTY)
router.post(
  "/section",
  requireRole(ROLES.FACULTY, ROLES.ADMIN, ROLES.STAFF),
  validate(submitSectionAttendanceSchema),
  controller.submitSectionAttendance,
);

// View attendance sheet for a class + date (FACULTY/ADMIN/STAFF)
router.get(
  "/class/:classId",
  requireRole(ROLES.FACULTY, ROLES.ADMIN, ROLES.STAFF),
  controller.getClassSheet,
);

// View attendance history for one student (self for STUDENT, or staff)
router.get(
  "/student/:studentId",
  requireRole(ROLES.FACULTY, ROLES.ADMIN, ROLES.STAFF, ROLES.STUDENT),
  controller.getStudentHistory,
);

export default router;
