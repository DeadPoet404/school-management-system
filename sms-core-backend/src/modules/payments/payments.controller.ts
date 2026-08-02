import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { AppError } from '@/middleware/error.handler';
import { PaymentsService } from './payments.service';

export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  createPaystackIntent = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.paymentsService.createPaystackIntent(
        req.body,
        req.user?.email ?? 'unknown',
      );
      return res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  createSelfPaystackIntent = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const studentId = this.resolveStudentId(req);
      const data = await this.paymentsService.createSelfPaystackIntent(
        studentId,
        req.body,
        req.user?.email ?? 'unknown',
      );
      return res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  cancelIntent = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const reference = req.params.reference;
      if (!reference) {
        return next(new AppError(400, 'Payment intent reference is required.'));
      }
      const data = await this.paymentsService.cancelIntent(reference, req.user!);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getIntentStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const reference = req.params.reference;
      if (!reference) {
        return next(new AppError(400, 'Payment intent reference is required.'));
      }
      const verify = req.query.verify === 'true';
      const data = await this.paymentsService.getIntentStatus(
        reference,
        req.user!,
        { verify },
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  listIntents = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const rawStudentId =
        typeof req.query.studentId === 'string' && req.query.studentId
          ? req.query.studentId
          : undefined;
      if (rawStudentId) {
        const uuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuid.test(rawStudentId)) {
          return next(new AppError(400, 'Invalid studentId format.'));
        }
      }
      const rawStatus =
        typeof req.query.status === 'string' && req.query.status
          ? req.query.status
          : undefined;

      const data = await this.paymentsService.listIntents(
        { studentId: rawStudentId, status: rawStatus },
        req.user!,
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  reconcileIntent = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const reference = req.params.reference;
      if (!reference) {
        return next(new AppError(400, 'Payment intent reference is required.'));
      }
      const data = await this.paymentsService.reconcileIntentByReference(
        reference,
        req.user!,
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  /** Object-level source of truth: the student comes from the session, never the body. */
  getSelfFeesSummary = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const studentId = this.resolveStudentId(req);
      const data = await this.paymentsService.getSelfFeesSummary(studentId, req.user!);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  private resolveStudentId(req: AuthenticatedRequest): string {
    const user = req.user;
    if (user && user.entityType === 'STUDENT' && user.entityInternalId) {
      return user.entityInternalId;
    }
    throw new AppError(403, 'This endpoint is for student self-service payments.');
  }
}
