import { Request, Response, NextFunction } from "express";
import { TeacherService } from "./teacher.service";
import { parsePaginationQuery, buildPaginationResponse } from "@/utils/pagination";

export class TeacherController {
  constructor(private teacherService: TeacherService) {}
  
  public getAllTeachers = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { page, limit, skip } = parsePaginationQuery(req.query);
      const { data, total } = await this.teacherService.getPaginatedTeachers(skip, limit);
      return res.status(200).json(buildPaginationResponse(data, total, page, limit));
    } catch (error) {
      next(error);
    }
  };

  public createTeacher = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { account, placement } = req.body;

      if (!account?.fullName || !account?.email) {
        return res.status(400).json({ success: false, message: "Missing core identity payloads (fullName and email are required)." });
      }

      const newTeacher = await this.teacherService.createTeacher({
        account: { fullName: account.fullName, email: account.email },
        placement: placement ? { departmentId: placement.departmentId, jobTitle: placement.jobTitle, employmentType: placement.employmentType } : undefined,
      });

      return res.status(201).json({ success: true, teacherId: newTeacher.teacherId, name: newTeacher.teacherName, message: "Faculty profile saved to database successfully." });
    } catch (error) {
      next(error);
    }
  };

  public executeDeparture = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { teacherId, departureType, effectiveDate, clearance, remarks } = req.body;

      if (!teacherId || !departureType || !effectiveDate || !clearance?.academic || !clearance?.treasury || !remarks) {
        return res.status(400).json({ success: false, message: "Missing structural faculty departure payload dependencies." });
      }

      const result = await this.teacherService.processDeparture({
        teacherId, departureType, effectiveDate,
        clearance: { academic: clearance.academic, treasury: clearance.treasury },
        remarks,
      });

      return res.status(200).json({ success: true, message: `Faculty departure pipeline finalized for ID: ${teacherId}`, data: result });
    } catch (error) {
      next(error);
    }
  };

  public updateTeacher = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { id } = req.params;
      const updated = await this.teacherService.update(id, req.body);
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

}
