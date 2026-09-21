import { Router } from "express";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";
import { validate } from "@/middleware/validate";
import { TransportController } from "./transport.controller";
import { TransportService } from "./transport.service";
import {
  assignmentCreateSchema,
  busCreateSchema,
  cardIssueSchema,
  syncBatchSchema,
  tripOpenSchema,
  tripStatusSchema,
} from "./transport.validation";

const router = Router();
const service = new TransportService();
const controller = new TransportController(service);
const transportAccess = requireRole(ROLES.ADMIN, ROLES.STAFF);

router.use(transportAccess);

// Control-room setup contracts.
router.get("/buses", controller.listBuses);
router.post("/buses", validate(busCreateSchema), controller.createBus);
router.get("/students", controller.listStudents);
router.post("/assignments", validate(assignmentCreateSchema), controller.createAssignment);
router.post("/cards", validate(cardIssueSchema), controller.issueCard);

// One trip per bus, direction, and service date.
router.get("/trips", controller.listTrips);
router.post("/trips", validate(tripOpenSchema), controller.openTrip);
router.patch("/trips/:id/status", validate(tripStatusSchema), controller.updateTripStatus);

// Device roster and offline batch-sync contracts.
router.get("/roster", controller.getRoster);
router.post("/sync", validate(syncBatchSchema), controller.syncBatch);

// Exception and reporting contracts.
router.get("/exceptions", controller.getExceptions);
router.get("/reports/boardings", controller.getReport);

export default router;
