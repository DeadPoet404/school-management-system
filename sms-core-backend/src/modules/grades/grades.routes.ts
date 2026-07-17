import { Router } from "express";
import { GradesController } from "./grades.controller";
import { GradesService } from "./grades.service";
import { GradesRepository } from "./grades.repository";
import { validate } from "@/middleware/validate";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";
import { submitMarkSchema } from "./grades.validation";

const router = Router();

// ── DEPENDENCY WIRING ──
const gradesRepo = new GradesRepository();
const gradesService = new GradesService(gradesRepo);
const gradesController = new GradesController(gradesService);

router.post(
  "/submit",
  requireRole(ROLES.FACULTY),
  validate(submitMarkSchema),
  gradesController.submitMark
);

export default router;
