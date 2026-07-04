import { Request, Response, NextFunction } from "express";
import { StaffService } from "./staff.service";

// Instantiate the service container context
const staffService = new StaffService();

export class StaffController {
  /**
   * GET /api/staff
   * Fetches the formatted administrative staff lines for the UI grid.
   */
  public getAllStaff = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const staff = await staffService.getAllStaff();

      return res.status(200).json({
        success: true,
        data: staff,
      });
    } catch (error) {
      next(error); // Delegated to global error handling pipeline
    }
  };

  /**
   * GET /api/staff/matrix
   * Fetches the high-density workforce operational shift and department allocations.
   */
  public getWorkforceMatrix = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const matrix = await staffService.getWorkforceMatrix();
      
      return res.status(200).json({
        success: true,
        data: matrix
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/staff
   * Validates payload and delegates atomic staff registration to the Service layer.
   */
  public createStaff = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { account, demographics, placement, compliance, payroll } = req.body;

      // Fail-fast checks maintaining structural consistency with your main Zod pipeline guards
      if (!account?.fullName || !account?.email || !account?.password) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing core onboarding requirements (fullName, email, and password are required)." 
        });
      }

      // Explicitly pass structured object trees down to the service layer contract
      const newStaff = await staffService.createStaff({
        account: {
          fullName: account.fullName,
          email: account.email,
          password: account.password,
          employmentDate: account.employmentDate || new Date().toISOString(),
          role: account.role
        },
        demographics,
        placement,
        compliance,
        payroll
      });

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
      
      next(error); // Global interceptor catches other runtime database anomalies
    }
  };

  /**
   * POST /api/staff/departure
   * Validates departure payload and delegates offboarding to the Service layer.
   */
  public executeDeparture = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
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

      const result = await staffService.processDeparture({
        staffId,
        departureType,
        effectiveDate,
        clearance: {
          hr: clearance.hr,
          itAssets: clearance.itAssets,
          treasury: clearance.treasury
        },
        remarks
      });

      return res.status(200).json({
        success: true,
        message: `Staff departure pipeline finalized for ID: ${staffId}`,
        data: result,
      });
    } catch (error: any) {
      if (error.message?.includes("lookup failed") || error.message?.includes("not found")) {
        return res.status(404).json({
          success: false,
          message: error.message || "Target administrative record not found.",
        });
      }
      
      return res.status(422).json({
        success: false,
        message: error.message || "Staff excision pipeline execution failed.",
      });
    }
  };
}