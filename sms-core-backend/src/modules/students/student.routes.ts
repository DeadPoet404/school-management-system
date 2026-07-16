import { Router } from "express";
import { StudentController } from "./student.controller";
import { StudentService } from "./student.service";
import { StudentRepository } from "./student.repository";
import { validate } from "@/middleware/validate";
import { studentEnrollmentSchema, studentDepartureSchema } from "@/types/registry.types";

const router = Router();

// ── DEPENDENCY WIRING ──
const studentRepo = new StudentRepository();
const studentService = new StudentService(studentRepo);
const controller = new StudentController(studentService);

// ── SPECIALIZED DOMAIN TARGETS ──
router.get("/finance", controller.getFinancialMatrix);

router.post(
  "/departure",
  validate(studentDepartureSchema),
  controller.executeDeparture
);

// ── CORE REGISTRY ENTRIES ──
router.get("/", controller.getAllStudents);

router.post(
  "/",
  validate(studentEnrollmentSchema),
  controller.enrollStudent
);

export default router;
