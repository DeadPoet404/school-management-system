import { Router } from "express";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";
import { AttendanceRepository } from "./attendance.repository";
import { validate } from "@/middleware/validate";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";
import {
  submitSectionAttendanceSchema,
  correctStudentAttendanceSchema,
} from "./attendance.validation";

const router = Router();

const attendanceRepo = new AttendanceRepository();
const attendanceService = new AttendanceService(attendanceRepo);
const controller = new AttendanceController(attendanceService);

// Submit attendance (FACULTY only per V1 policy)
router.post(
  "/section",
  requireRole(ROLES.FACULTY),
  validate(submitSectionAttendanceSchema),
  controller.submitSectionAttendance,
);

// Correct one existing attendance record (FACULTY and ADMIN per V1 policy). The global audit middleware logs
// every PATCH request; this handler rejects missing records rather than upserting.
router.patch(
  "/student/:studentId",
  requireRole(ROLES.FACULTY, ROLES.ADMIN),
  validate(correctStudentAttendanceSchema),
  controller.correctStudentAttendance,
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
