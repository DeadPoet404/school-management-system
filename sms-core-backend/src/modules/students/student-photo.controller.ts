import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { StudentPhotoService } from './student-photo.service';

type UploadedStudentPhotoFile = {
  buffer: Buffer;
  mimetype?: string;
  size?: number;
};

export class StudentPhotoController {
  constructor(private readonly studentPhotoService: StudentPhotoService) {}

  public upload = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const file = (
        req as AuthenticatedRequest & { file?: UploadedStudentPhotoFile }
      ).file;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'A JPEG, PNG, or WebP student photo is required.',
        });
      }

      const result = await this.studentPhotoService.upload(req.params.id!, {
        buffer: file.buffer,
        declaredMimeType: file.mimetype,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public redirectToPhoto = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const signedUrl = await this.studentPhotoService.createSignedUrl(
        req.params.id!,
      );

      res.setHeader('Cache-Control', 'private, no-store');
      return res.redirect(302, signedUrl);
    } catch (error) {
      next(error);
    }
  };

  public remove = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const result = await this.studentPhotoService.remove(req.params.id!);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
