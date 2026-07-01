import { Router } from "express";
import { TeacherController } from "./teacher.controller";
import { validate } from "@/middleware/validate";
import { createTeacherSchema } from "@/types/teacher.types";

const router = Router();
const teacherController = new TeacherController();

// ── SPECIALIZED DOMAIN TARGETS ──
router.post("/departure", teacherController.executeDeparture);

// ── CORE REGISTRY ENTRIES ──
router.get("/", teacherController.getAllTeachers);
router.post("/", validate(createTeacherSchema), teacherController.createTeacher);

export default router;