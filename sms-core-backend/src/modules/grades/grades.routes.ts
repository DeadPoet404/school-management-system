import { Router } from "express";
import { GradesController } from "./grades.controller";
import { GradesService } from "./grades.service";
import { GradesRepository } from "./grades.repository";
import { validate } from "@/middleware/validate";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";
import { submitMarkSchema, correctMarkSchema } from "./grades.validation";

const router = Router();

// ── DEPENDENCY WIRING ──
const gradesRepo = new GradesRepository();
const gradesService = new GradesService(gradesRepo);
const gradesController = new GradesController(gradesService);

// Gradebook entry is FACULTY only per V1 policy
router.post(
  "/submit",
  requireRole(ROLES.FACULTY),
  validate(submitMarkSchema),
  gradesController.submitMark
);

// ── D-07 READ ENDPOINTS ──
// The module previously registered only POST /submit, so grades could be
// written but never read back through the API.

// Paginated gradebook: /api/grades?classId=&subjectId=&termId=&studentId=
router.get(
  "/",
  requireRole(ROLES.FACULTY, ROLES.ADMIN, ROLES.STAFF),
  gradesController.listGrades
);

// One student's transcript: /api/grades/student/:studentId?termId=
router.get(
  "/student/:studentId",
  requireRole(ROLES.FACULTY, ROLES.ADMIN, ROLES.STAFF, ROLES.STUDENT),
  gradesController.getStudentGradebook
);

// Correct an existing mark. Grades are never deleted through the API -
// academic records are amended, not erased. auditLog captures every PATCH.
router.patch(
  "/:id",
  requireRole(ROLES.FACULTY, ROLES.ADMIN),
  validate(correctMarkSchema),
  gradesController.correctMark
);

export default router;
