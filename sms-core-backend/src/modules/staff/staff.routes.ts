import { Router, type RequestHandler } from "express";
import multer from "multer";
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

const staffImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const handleStaffImportUpload: RequestHandler = (req, res, next) => {
  staffImportUpload.single("file")(req, res, (error: unknown) => {
    if (error) {
      const message = error instanceof Error ? error.message : "Staff import upload failed.";
      return res.status(400).json({ success: false, message });
    }

    next();
  });
};

// ── SPECIALIZED DOMAIN TARGETS ──
router.post(
  "/import",
  requireRole(ROLES.STAFF, ROLES.ADMIN),
  handleStaffImportUpload,
  staffController.importStaff
);

router.post("/departure", requireRole(ROLES.STAFF, ROLES.ADMIN), validate(staffDepartureSchema), staffController.executeDeparture);

// ── STAFF PERFORMANCE METRICS ──
router.get("/performance", requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT), staffController.getPerformanceMetrics);

// ── HIGH-DENSITY WORKFORCE ANALYTICS ──
router.get("/matrix", requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT), staffController.getWorkforceMatrix);

// ── CORE REGISTRY ENTRIES ──
router.get("/", requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT), staffController.getAllStaff);
router.get("/:id", requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT), staffController.getStaffById);
router.post("/", requireRole(ROLES.STAFF, ROLES.ADMIN), validate(staffEnrollmentSchema), staffController.createStaff);

// ── UPDATE ──
router.patch("/:id", requireRole(ROLES.STAFF, ROLES.ADMIN), validate(staffUpdateSchema), staffController.updateStaff);

export default router;
