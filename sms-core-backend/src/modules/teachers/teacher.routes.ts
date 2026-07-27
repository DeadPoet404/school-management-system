import { Router, type RequestHandler } from "express";
import multer from "multer";
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

const teacherImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const handleTeacherImportUpload: RequestHandler = (req, res, next) => {
  teacherImportUpload.single("file")(req, res, (error: unknown) => {
    if (error) {
      const message = error instanceof Error ? error.message : "Teacher import upload failed.";
      return res.status(400).json({ success: false, message });
    }

    next();
  });
};

// ── SPECIALIZED DOMAIN TARGETS ──
router.post(
  "/import",
  requireRole(ROLES.STAFF, ROLES.ADMIN),
  handleTeacherImportUpload,
  teacherController.importTeachers
);

router.post("/departure", requireRole(ROLES.STAFF, ROLES.ADMIN), validate(teacherDepartureSchema), teacherController.executeDeparture);

// ── CORE REGISTRY ENTRIES ──
router.get("/", requireRole(ROLES.STAFF, ROLES.FACULTY, ROLES.ADMIN), teacherController.getAllTeachers);
router.get("/:id", requireRole(ROLES.STAFF, ROLES.FACULTY, ROLES.ADMIN), teacherController.getTeacherById);
router.post("/", requireRole(ROLES.STAFF, ROLES.ADMIN), validate(teacherEnrollmentSchema), teacherController.createTeacher);

// ── UPDATE ──
router.patch("/:id", requireRole(ROLES.STAFF, ROLES.ADMIN), validate(teacherUpdateSchema), teacherController.updateTeacher);

export default router;
