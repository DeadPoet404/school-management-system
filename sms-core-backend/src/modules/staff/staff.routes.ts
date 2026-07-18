import { Router } from "express";
import { StaffController } from "./staff.controller";
import { StaffService } from "./staff.service";
import { StaffRepository } from "./staff.repository";
import { validate } from "@/middleware/validate";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";
import { staffEnrollmentSchema, staffDepartureSchema } from "@/types/registry.types";
import { staffUpdateSchema } from "./staff.validation";

const router = Router();

// ── DEPENDENCY WIRING ──
const staffRepo = new StaffRepository();
const staffService = new StaffService(staffRepo);
const staffController = new StaffController(staffService);

// ── SPECIALIZED DOMAIN TARGETS ──
router.post("/departure", requireRole(ROLES.STAFF, ROLES.ADMIN), validate(staffDepartureSchema), staffController.executeDeparture);

// ── HIGH-DENSITY WORKFORCE ANALYTICS ──
router.get("/matrix", requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT), staffController.getWorkforceMatrix);

// ── CORE REGISTRY ENTRIES ──
router.get("/", requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT), staffController.getAllStaff);
router.get("/:id", requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT), staffController.getStaffById);
router.post("/", requireRole(ROLES.STAFF, ROLES.ADMIN), validate(staffEnrollmentSchema), staffController.createStaff);

// ── UPDATE ──
router.patch("/:id", requireRole(ROLES.STAFF, ROLES.ADMIN), validate(staffUpdateSchema), staffController.updateStaff);

export default router;
