import { Request, Response } from "express";
import { StaffService } from "./staff.service";

// Instantiate the service container context
const staffService = new StaffService();

export class StaffController {
  /**
   * Fetches full relational staff graph rows from the database service.
   * Maps to GET /api/staff
   */
  public getAllStaff = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const staff = await staffService.getAllStaff();

      return res.status(200).json({
        success: true,
        data: staff,
      });
    } catch (error: any) {
      console.error("Database fetch error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve relational staff records from the database.",
      });
    }
  };

  /**
   * Validates payload and delegates atomic staff registration to the Service layer.
   * Maps to POST /api/staff
   */
    public createStaff = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      // Zod already guaranteed this payload is perfectly safe!
      const newStaff = await staffService.createStaff(req.body);

      return res.status(201).json({
        success: true,
        message: "Atomic staff registration ingestion transaction pipelines complete.",
        data: newStaff,
      });
    } catch (error: any) {
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          message: "A staff member with this email address already exists in the registry.",
        });
      }
      
      console.error("Database ingestion error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to execute nested database mutation pipelines for staff.",
      });
    }
  };
  /**
   * POST /api/staff/departure
   * Validates departure payload and delegates offboarding to the Service layer.
   */
  public executeDeparture = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const { staffId, departureType, effectiveDate, clearance, remarks } = req.body;

      // Fail-fast validation matching the exact structure sent by the React frontend
      if (
        !staffId ||
        !departureType ||
        !effectiveDate ||
        !clearance?.hr ||
        !clearance?.itAssets ||
        !clearance?.treasury ||
        !remarks
      ) {
        return res.status(400).json({
          success: false,
          message: "Missing structural staff departure payload dependencies.",
        });
      }

      // Delegate to the service method
      const result = await staffService.processDeparture(req.body);

      return res.status(200).json({
        success: true,
        message: `Staff departure pipeline finalized for ID: ${staffId}`,
        data: result,
      });
    } catch (error: any) {
      // Return 404 if the staff member doesn't exist, otherwise 422 for logic errors
      const statusCode = error.message.includes("lookup failed") ? 404 : 422;
      return res.status(statusCode).json({
        success: false,
        message: error.message || "Staff excision pipeline execution failed.",
      });
    }
  };
}