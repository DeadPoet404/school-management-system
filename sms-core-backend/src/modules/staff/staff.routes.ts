import { Router } from "express";
import { StaffController } from "./staff.controller";
import { validate } from "@/middleware/validate";
import { createStaffSchema } from "@/types/staff.types";

const router = Router();
const staffController = new StaffController();

// ── SPECIALIZED DOMAIN TARGETS ──
router.post("/departure", staffController.executeDeparture);

// ── CORE REGISTRY ENTRIES ──
router.get("/", staffController.getAllStaff);
router.post("/", validate(createStaffSchema), staffController.createStaff);

export default router;