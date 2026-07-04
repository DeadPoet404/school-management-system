import { Router } from "express";
import { StudentController } from "./student.controller";
import { validate } from "@/middleware/validate";
import { studentEnrollmentSchema, studentDepartureSchema } from "@/types/registry.types";
// import { requireAuth } from "@/middleware/auth";

const router = Router();
const controller = new StudentController();

// ── SPECIALIZED DOMAIN TARGETS ──
// Explicit paths reside at the peak of the routing stack to prevent wildcard collisions.
router.get("/finance", controller.getFinancialMatrix);

router.post(
  "/departure", 
  validate(studentDepartureSchema), 
  controller.executeDeparture
);

// ── CORE REGISTRY ENTRIES ──
// Request execution pipeline order: Auth (when active) -> Structural Guard -> Domain Controller
router.get("/", controller.getAllStudents);

router.post(
  "/", 
  validate(studentEnrollmentSchema), 
  controller.enrollStudent
);

export default router;