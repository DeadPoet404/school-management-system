import { Router } from "express";
import { StudentController } from "./student.controller";
import { validate } from "@/middleware/validate";
import { createStudentSchema } from "@/types/student.types";

const router = Router();
const controller = new StudentController();

// ── SPECIALIZED DOMAIN TARGETS ──
router.get("/finance", controller.getFinancialMatrix);
router.post("/departure", controller.executeDeparture);

// ── CORE REGISTRY ENTRIES ──
router.get("/", controller.getAllStudents);
router.post("/", validate(createStudentSchema), controller.enrollStudent);

export default router;