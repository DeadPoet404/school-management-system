import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/middleware/error.handler';
import { SetupService } from './setup.service';
import {
  bootstrapSetupSchema,
  setupAcademicSchema,
  setupClassesSchema,
  setupCurriculumSchema,
  setupLedgerSchema,
} from './setup.validation';

function firstZodMessage(error: { issues: { message: string }[] }, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

export class SetupController {
  constructor(private service: SetupService = new SetupService()) {}

  async getStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await this.service.getStatus();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async bootstrap(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = bootstrapSetupSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, firstZodMessage(parsed.error, 'Invalid bootstrap payload.'));
      }
      const data = await this.service.bootstrap(parsed.data);
      res.status(201).json({
        success: true,
        message:
          'School profile and founding administrator created. Sign in as the admin to continue the setup wizard.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async saveAcademic(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = setupAcademicSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, firstZodMessage(parsed.error, 'Invalid academic payload.'));
      }
      const data = await this.service.saveAcademic(parsed.data);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async saveClasses(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = setupClassesSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, firstZodMessage(parsed.error, 'Invalid classes payload.'));
      }
      const data = await this.service.saveClasses(parsed.data);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async saveCurriculum(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = setupCurriculumSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, firstZodMessage(parsed.error, 'Invalid curriculum payload.'));
      }
      const data = await this.service.saveCurriculum(parsed.data);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async saveLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = setupLedgerSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new AppError(400, firstZodMessage(parsed.error, 'Invalid ledger payload.'));
      }
      const data = await this.service.saveLedger(parsed.data);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async complete(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await this.service.complete();
      res.status(200).json({
        success: true,
        message: 'First-start setup complete. The school is ready for daily operations.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
