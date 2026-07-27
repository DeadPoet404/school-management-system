import { Router, type RequestHandler } from "express";
import multer from "multer";
import { StudentController } from "./student.controller";
import { StudentService } from "./student.service";
import { StudentRepository } from "./student.repository";
import { validate } from "@/middleware/validate";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";
import { studentEnrollmentSchema, studentDepartureSchema } from "@/types/registry.types";
import { studentUpdateSchema } from "./student.validation";

const router = Router();

// ── DEPENDENCY WIRING ──
const studentRepo = new StudentRepository();
const studentService = new StudentService(studentRepo);
const controller = new StudentController(studentService);

const studentImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const handleStudentImportUpload: RequestHandler = (req, res, next) => {
  studentImportUpload.single("file")(req, res, (error: unknown) => {
    if (error) {
      const message = error instanceof Error ? error.message : "Student import upload failed.";
      return res.status(400).json({ success: false, message });
    }

    next();
  });
};

// ── SPECIALIZED DOMAIN TARGETS ──
router.post(
  "/import",
  requireRole(ROLES.STAFF, ROLES.ADMIN),
  handleStudentImportUpload,
  controller.importStudents
);

router.get("/finance", requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getFinancialMatrix);

router.get("/:id", requireRole(ROLES.STAFF, ROLES.FACULTY, ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getStudentById);

router.post(
  "/departure",
  requireRole(ROLES.STAFF, ROLES.ADMIN),
  validate(studentDepartureSchema),
  controller.executeDeparture
);

// ── CORE REGISTRY ENTRIES ──
router.get("/", requireRole(ROLES.STAFF, ROLES.FACULTY, ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getAllStudents);

router.post(
  "/",
  requireRole(ROLES.STAFF, ROLES.ADMIN),
  validate(studentEnrollmentSchema),
  controller.enrollStudent
);

// ── UPDATE ──
router.patch(
  "/:id",
  requireRole(ROLES.STAFF, ROLES.ADMIN),
  validate(studentUpdateSchema),
  controller.updateStudent
);

export default router;
