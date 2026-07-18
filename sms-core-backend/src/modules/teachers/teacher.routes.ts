import { Router } from "express";
import { TeacherController } from "./teacher.controller";
import { TeacherService } from "./teacher.service";
import { TeacherRepository } from "./teacher.repository";
import { validate } from "@/middleware/validate";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";
import { teacherEnrollmentSchema, teacherDepartureSchema } from "@/types/registry.types";
import { teacherUpdateSchema } from "./teacher.validation";

const router = Router();

// ── DEPENDENCY WIRING ──
const teacherRepo = new TeacherRepository();
const teacherService = new TeacherService(teacherRepo);
const teacherController = new TeacherController(teacherService);

// ── SPECIALIZED DOMAIN TARGETS ──
router.post("/departure", requireRole(ROLES.STAFF, ROLES.ADMIN), validate(teacherDepartureSchema), teacherController.executeDeparture);

// ── CORE REGISTRY ENTRIES ──
router.get("/", requireRole(ROLES.STAFF, ROLES.FACULTY, ROLES.ADMIN), teacherController.getAllTeachers);
router.post("/", requireRole(ROLES.STAFF, ROLES.ADMIN), validate(teacherEnrollmentSchema), teacherController.createTeacher);

// ── UPDATE ──
router.patch("/:id", requireRole(ROLES.STAFF, ROLES.ADMIN), validate(teacherUpdateSchema), teacherController.updateTeacher);

export default router;
