import { Request, Response, NextFunction } from "express";
import { PersonnelService } from "./personnel.service";

const personnelService = new PersonnelService();

export class PersonnelController {
  /**
   * Maps to POST /api/teachers/departure
   */
  public executeTeacherDeparture = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await personnelService.processTeacherDeparture(req.body);
      res.status(200).json({
        success: true,
        message: `Faculty offboarding finalized for ID: ${req.body.teacherId}`,
        data: result,
      });
    } catch (error: any) {
      if (error.message?.includes("lookup failed")) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      res.status(422).json({ success: false, message: error.message || "Pipeline execution failed." });
    }
  };

  /**
   * Maps to POST /api/staff/departure
   */
  public executeStaffDeparture = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await personnelService.processStaffDeparture(req.body);
      res.status(200).json({
        success: true,
        message: `Staff member offboarding finalized for ID: ${req.body.staffId}`,
        data: result,
      });
    } catch (error: any) {
      if (error.message?.includes("lookup failed")) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      res.status(422).json({ success: false, message: error.message || "Pipeline execution failed." });
    }
  };
}