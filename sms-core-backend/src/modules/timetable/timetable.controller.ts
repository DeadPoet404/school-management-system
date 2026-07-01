import { Request, Response } from "express";
import { TimetableService } from "./timetable.service";

const timetableService = new TimetableService();

export class TimetableController {
  public getMatrix = async (req: Request, res: Response): Promise<Response> => {
    try {
      const currentMatrix = await timetableService.getGlobalMatrix();
      return res.status(200).json({ success: true, data: currentMatrix });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  public saveMatrix = async (req: Request, res: Response): Promise<Response> => {
    try {
      const fullMatrixPayload = req.body.data; 

      if (!fullMatrixPayload) {
        return res.status(400).json({ success: false, message: "Missing configuration matrix payload." });
      }

      // Delegate to a single atomic transaction in the service layer
      await timetableService.replaceGlobalMatrix(fullMatrixPayload);

      return res.status(200).json({ success: true, message: "Timetable matrix snapshot initialized successfully." });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };
}