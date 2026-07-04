import { Router } from "express";
import { TeacherController } from "./teacher.controller";
import { validate } from "@/middleware/validate";
import { teacherEnrollmentSchema, teacherDepartureSchema } from "@/types/registry.types";

const router = Router();
const teacherController = new TeacherController();

// ── SPECIALIZED DOMAIN TARGETS ──
// Explicit domain endpoints reside at the peak of the stack to block wildcard routing errors
router.post(
  "/departure", 
  validate(teacherDepartureSchema), 
  teacherController.executeDeparture
);

// ── CORE REGISTRY ENTRIES ──
router.get("/", teacherController.getAllTeachers);

router.post(
  "/", 
  validate(teacherEnrollmentSchema), 
  teacherController.createTeacher
);

export default router;