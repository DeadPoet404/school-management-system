import { Router } from "express";
import { StudentController } from "./student.controller";
import { StudentService } from "./student.service";
import { StudentRepository } from "./student.repository";
import { validate } from "@/middleware/validate";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";
import { studentEnrollmentSchema, studentDepartureSchema } from "@/types/registry.types";

const router = Router();

// ── DEPENDENCY WIRING ──
const studentRepo = new StudentRepository();
const studentService = new StudentService(studentRepo);
const controller = new StudentController(studentService);

// ── SPECIALIZED DOMAIN TARGETS ──
router.get("/finance", requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getFinancialMatrix);

router.post(
  "/departure",
  requireRole(ROLES.STAFF, ROLES.ADMIN),
  validate(studentDepartureSchema),
  controller.executeDeparture
);

// ── CORE REGISTRY ENTRIES ──
router.get("/", requireRole(ROLES.STAFF, ROLES.FACULTY, ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getAllStudents);

router.post(
  "/",
  requireRole(ROLES.STAFF, ROLES.ADMIN),
  validate(studentEnrollmentSchema),
  controller.enrollStudent
);

export default router;
