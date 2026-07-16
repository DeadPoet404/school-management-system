import { Router } from "express";
import { TeacherController } from "./teacher.controller";
import { TeacherService } from "./teacher.service";
import { TeacherRepository } from "./teacher.repository";
import { validate } from "@/middleware/validate";
import { teacherEnrollmentSchema, teacherDepartureSchema } from "@/types/registry.types";

const router = Router();

// ── DEPENDENCY WIRING ──
const teacherRepo = new TeacherRepository();
const teacherService = new TeacherService(teacherRepo);
const teacherController = new TeacherController(teacherService);

// ── SPECIALIZED DOMAIN TARGETS ──
router.post("/departure", validate(teacherDepartureSchema), teacherController.executeDeparture);

// ── HIGH-DENSITY ACADEMIC FACULTY ANALYTICS ──
router.get("/matrix", teacherController.getAllTeachers);

// ── CORE REGISTRY ENTRIES ──
router.get("/", teacherController.getAllTeachers);
router.post("/", validate(teacherEnrollmentSchema), teacherController.createTeacher);

export default router;
