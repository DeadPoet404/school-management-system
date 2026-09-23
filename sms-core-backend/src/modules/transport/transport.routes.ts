import { Router } from "express";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";
import { validate } from "@/middleware/validate";
import { TransportController } from "./transport.controller";
import { TransportService } from "./transport.service";
import {
  assignmentCreateSchema,
  busCreateSchema,
  busDriverAssignSchema,
  cardIssueSchema,
  routeCreateSchema,
  routeUpdateSchema,
  stopCreateSchema,
  stopUpdateSchema,
  syncBatchSchema,
  tripOpenSchema,
  tripStatusSchema,
} from "./transport.validation";

const router = Router();
const service = new TransportService();
const controller = new TransportController(service);

// All transport endpoints require auth (applied upstream) + at least one transport role.
// DRIVER is included for driver portal: they can only access scoped endpoints.
const anyTransportRole = requireRole(ROLES.ADMIN, ROLES.STAFF, ROLES.DRIVER);
const adminOnly = requireRole(ROLES.ADMIN, ROLES.STAFF);

router.use(anyTransportRole);

// ── Driver + admin shared (read + operational) ──
router.get("/buses", controller.listBuses);
router.get("/routes", controller.listRoutes);
router.get("/routes/:id", controller.getRoute);
router.get("/trips", controller.listTrips);
router.post("/trips", validate(tripOpenSchema), controller.openTrip);
router.patch("/trips/:id/status", validate(tripStatusSchema), controller.updateTripStatus);
router.get("/roster", controller.getRoster);
router.post("/sync", validate(syncBatchSchema), controller.syncBatch);
router.get("/exceptions", controller.getExceptions);
router.get("/reports/boardings", controller.getReport);

// ── Admin-only control room ──
router.post("/buses", adminOnly, validate(busCreateSchema), controller.createBus);
router.patch("/buses/:id/driver", adminOnly, validate(busDriverAssignSchema), controller.assignDriver);
router.get("/drivers", adminOnly, controller.listDrivers);

router.post("/routes", adminOnly, validate(routeCreateSchema), controller.createRoute);
router.patch("/routes/:id", adminOnly, validate(routeUpdateSchema), controller.updateRoute);
router.post("/routes/:id/stops", adminOnly, validate(stopCreateSchema), controller.createStop);
router.patch("/stops/:id", adminOnly, validate(stopUpdateSchema), controller.updateStop);

router.get("/students", adminOnly, controller.listStudents);
router.post("/assignments", adminOnly, validate(assignmentCreateSchema), controller.createAssignment);
router.post("/cards", adminOnly, validate(cardIssueSchema), controller.issueCard);

export default router;
