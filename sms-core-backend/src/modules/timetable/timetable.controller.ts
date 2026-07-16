import { Request, Response, NextFunction } from "express";
import { TimetableService } from "./timetable.service";

export class TimetableController {
  constructor(private timetableService: TimetableService) {}

  public getMatrix = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentMatrix = await this.timetableService.getGlobalMatrix();
      return res.status(200).json({ success: true, data: currentMatrix });
    } catch (error) {
      next(error);
    }
  };

  public saveMatrix = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fullMatrixPayload = req.body.data; 

      if (!fullMatrixPayload) {
        return res.status(400).json({ success: false, message: "Missing configuration matrix payload." });
      }

      await this.timetableService.replaceGlobalMatrix(fullMatrixPayload);

      return res.status(200).json({ success: true, message: "Timetable matrix snapshot initialized successfully." });
    } catch (error) {
      next(error);
    }
  };
}
