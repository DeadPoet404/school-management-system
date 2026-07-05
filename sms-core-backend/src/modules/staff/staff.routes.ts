import { Router } from "express";
import { StaffController } from "./staff.controller";
import { validate } from "@/middleware/validate";
import { staffEnrollmentSchema, staffDepartureSchema } from "@/types/registry.types";

const router = Router();
const staffController = new StaffController();

// ── SPECIALIZED DOMAIN TARGETS ──
router.post(
  "/departure", 
  validate(staffDepartureSchema), 
  staffController.executeDeparture
);

// ── HIGH-DENSITY WORKFORCE ANALYTICS ──
router.get(
  "/matrix", 
  staffController.getWorkforceMatrix
);

// ── CORE REGISTRY ENTRIES ──
router.get("/", staffController.getAllStaff);

router.post(
  "/", 
  validate(staffEnrollmentSchema), 
  staffController.createStaff
);

export default router;