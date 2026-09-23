import { Response, NextFunction } from "express";
import { AppError } from "@/middleware/error.handler";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { TransportService, parseReportDate } from "./transport.service";
import { rosterQuerySchema } from "./transport.validation";

function queryString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function readDirection(value: unknown): "TO_SCHOOL" | "FROM_SCHOOL" | undefined {
  const direction = queryString(value);
  if (direction === undefined) return undefined;
  if (direction !== "TO_SCHOOL" && direction !== "FROM_SCHOOL") {
    throw new AppError(400, "direction must be TO_SCHOOL or FROM_SCHOOL.");
  }
  return direction;
}

function readRosterQuery(req: AuthenticatedRequest) {
  const result = rosterQuerySchema.safeParse({
    busId: queryString(req.query.busId),
    serviceDate: queryString(req.query.serviceDate),
    direction: queryString(req.query.direction),
    knownVersion: queryString(req.query.knownVersion),
  });
  if (!result.success) {
    throw new AppError(400, result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  }
  return result.data;
}

function actorFromReq(req: AuthenticatedRequest) {
  return {
    role: req.user?.role,
    entityInternalId: req.user?.entityInternalId,
  };
}

export class TransportController {
  constructor(private readonly service: TransportService) {}

  listBuses = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const actor = actorFromReq(req);
      res.json({
        success: true,
        data: await this.service.listBuses({ driverStaffId: actor.entityInternalId, role: actor.role }),
      });
    } catch (error) {
      next(error);
    }
  };

  createBus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({ success: true, data: await this.service.createBus(req.body) });
    } catch (error) {
      next(error);
    }
  };

  assignDriver = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const busId = req.params.id!;
      const { driverStaffId } = req.body as { driverStaffId: string | null };
      res.json({ success: true, data: await this.service.assignDriverToBus(busId, driverStaffId) });
    } catch (error) {
      next(error);
    }
  };

  listDrivers = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await this.service.listDrivers() });
    } catch (error) {
      next(error);
    }
  };

  listRoutes = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await this.service.listRoutes() });
    } catch (error) {
      next(error);
    }
  };

  createRoute = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({ success: true, data: await this.service.createRoute(req.body) });
    } catch (error) {
      next(error);
    }
  };

  getRoute = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await this.service.getRoute(req.params.id!) });
    } catch (error) {
      next(error);
    }
  };

  updateRoute = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await this.service.updateRoute(req.params.id!, req.body) });
    } catch (error) {
      next(error);
    }
  };

  createStop = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({ success: true, data: await this.service.createStop(req.params.id!, req.body) });
    } catch (error) {
      next(error);
    }
  };

  updateStop = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await this.service.updateStop(req.params.id!, req.body) });
    } catch (error) {
      next(error);
    }
  };

  listStudents = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await this.service.listStudentCandidates(queryString(req.query.search)) });
    } catch (error) {
      next(error);
    }
  };

  createAssignment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({ success: true, data: await this.service.createAssignment(req.body) });
    } catch (error) {
      next(error);
    }
  };

  issueCard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({ success: true, data: await this.service.issueCard(req.body) });
    } catch (error) {
      next(error);
    }
  };

  openTrip = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const actor = actorFromReq(req);
      res.status(201).json({ success: true, data: await this.service.openTrip(req.body, actor) });
    } catch (error) {
      next(error);
    }
  };

  listTrips = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const actor = actorFromReq(req);
      res.json({
        success: true,
        data: await this.service.listTrips(queryString(req.query.serviceDate), {
          driverStaffId: actor.entityInternalId,
          role: actor.role,
        }),
      });
    } catch (error) {
      next(error);
    }
  };

  updateTripStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const actor = actorFromReq(req);
      res.json({ success: true, data: await this.service.updateTripStatus(req.params.id!, req.body.status, actor) });
    } catch (error) {
      next(error);
    }
  };

  getRoster = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const actor = actorFromReq(req);
      res.json({ success: true, data: await this.service.getRoster(readRosterQuery(req), actor) });
    } catch (error) {
      next(error);
    }
  };

  syncBatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const actor = actorFromReq(req);
      const outcome = await this.service.syncBatch(req.body, req.user?.entityInternalId, actor);
      res.json({ success: true, data: outcome });
    } catch (error) {
      next(error);
    }
  };

  getReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const actor = actorFromReq(req);
      const now = new Date();
      const from = parseReportDate(queryString(req.query.from), new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      const to = parseReportDate(queryString(req.query.to), now);
      if (to <= from) throw new AppError(400, "Report 'to' must be after 'from'.");
      const report = await this.service.getReport(
        {
          from,
          to,
          busId: queryString(req.query.busId),
          direction: readDirection(req.query.direction),
        },
        { driverStaffId: actor.entityInternalId, role: actor.role }
      );
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  };

  getExceptions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const actor = actorFromReq(req);
      const now = new Date();
      const from = parseReportDate(queryString(req.query.from), new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      const to = parseReportDate(queryString(req.query.to), now);
      const report = await this.service.getReport(
        { from, to, busId: queryString(req.query.busId) },
        { driverStaffId: actor.entityInternalId, role: actor.role }
      );
      res.json({ success: true, data: { from, to, count: report.exceptions.length, exceptions: report.exceptions } });
    } catch (error) {
      next(error);
    }
  };
}
