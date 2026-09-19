import { Router, type RequestHandler } from "express";
import multer from "multer";
import { StudentController } from "./student.controller";
import { StudentService } from "./student.service";
import { StudentRepository } from "./student.repository";
import { StudentPhotoController } from "./student-photo.controller";
import { StudentPhotoService } from "./student-photo.service";
import { validate } from "@/middleware/validate";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";
import { studentEnrollmentSchema, studentDepartureSchema } from "@/types/registry.types";
import { studentUpdateSchema } from "./student.validation";

const router = Router();

// ── DEPENDENCY WIRING ──
const studentRepo = new StudentRepository();
const studentService = new StudentService(studentRepo);
const controller = new StudentController(studentService);
const studentPhotoService = new StudentPhotoService(studentRepo);
const studentPhotoController = new StudentPhotoController(studentPhotoService);

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

const studentPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const handleStudentPhotoUpload: RequestHandler = (req, res, next) => {
  studentPhotoUpload.single("photo")(req, res, (error: unknown) => {
    if (error) {
      const code = (
        error
        && typeof error === "object"
        && "code" in error
        && typeof error.code === "string"
      ) ? error.code : null;

      const message = code === "LIMIT_FILE_SIZE"
        ? "Student photo must not exceed 5 MB."
        : error instanceof Error
          ? error.message
          : "Student photo upload failed.";

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

// Must precede /:id so "family-matches" is not treated as a student id.
router.get(
  "/family-matches",
  requireRole(ROLES.STAFF, ROLES.ADMIN),
  controller.getFamilyMatches,
);

// SMS-005: portal self-view. MUST stay BEFORE /:id -- otherwise Express
// binds the literal "me" to the :id parameter and this route is shadowed.
router.get("/me", requireRole(ROLES.STUDENT), controller.getOwnProfile);
router.get("/me/transcript.pdf", requireRole(ROLES.STUDENT), controller.streamOwnTranscriptPdf);
router.get("/:id/transcript.pdf", requireRole(ROLES.ADMIN, ROLES.STAFF), controller.streamTranscriptPdf);
// SMS-009: print-ready class roster PDF (must precede the "/:id" route).
router.get("/class-list.pdf", requireRole(ROLES.ADMIN, ROLES.STAFF), controller.streamClassListPdf);
// SMS-009b: print-ready class roster HTML (native print dialog on load).
router.get("/class-list.print", requireRole(ROLES.ADMIN, ROLES.STAFF), controller.streamClassListPrint);

// Private student photos are never returned in generic student DTOs.
// The image endpoint issues a short-lived Storage redirect for authorized viewers.
router.get(
  "/:id/photo",
  requireRole(ROLES.STAFF, ROLES.FACULTY, ROLES.ADMIN, ROLES.ACCOUNTANT),
  studentPhotoController.redirectToPhoto
);

router.post(
  "/:id/photo",
  requireRole(ROLES.STAFF, ROLES.ADMIN),
  handleStudentPhotoUpload,
  studentPhotoController.upload
);

router.delete(
  "/:id/photo",
  requireRole(ROLES.STAFF, ROLES.ADMIN),
  studentPhotoController.remove
);

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
