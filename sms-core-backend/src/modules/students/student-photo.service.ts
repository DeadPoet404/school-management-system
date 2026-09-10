import { AppError } from '@/middleware/error.handler';
import { logger } from '@/lib/logger';
import type { IStudentRepository } from '@/types/repositories';
import {
  createStudentPhotoObjectKey,
  validateStudentPhoto,
  type StudentPhotoUploadInput,
} from '@/lib/student-photo';
import {
  createStudentPhotoStorage,
  StudentPhotoStorageConfigurationError,
  type SupabaseStudentPhotoStorage,
} from '@/lib/student-photo-storage';

type StudentPhotoStorage = Pick<
  SupabaseStudentPhotoStorage,
  'upload' | 'remove' | 'createSignedUrl'
>;

export type StudentPhotoStorageFactory = () => StudentPhotoStorage;

export type StudentPhotoUploadResult = {
  photoAvailable: true;
};

export type StudentPhotoDeleteResult = {
  photoAvailable: false;
};

type StudentPhotoRecord = {
  id: string;
  photoKey: string | null;
};

export class StudentPhotoService {
  constructor(
    private readonly repo: IStudentRepository,
    private readonly storageFactory: StudentPhotoStorageFactory =
      createStudentPhotoStorage,
  ) {}

  private createStorage(): StudentPhotoStorage {
    try {
      return this.storageFactory();
    } catch (error) {
      if (error instanceof StudentPhotoStorageConfigurationError) {
        throw new AppError(
          503,
          'Student photo uploads are not configured. Contact a system administrator.',
        );
      }

      throw error;
    }
  }

  private async getStudentPhotoRecord(
    studentInternalId: string,
  ): Promise<StudentPhotoRecord> {
    const student = await this.repo.findById(studentInternalId);

    if (!student) {
      throw new AppError(404, 'Student record was not found.');
    }

    return {
      id: student.id,
      photoKey:
        typeof student.photoKey === 'string' && student.photoKey.trim()
          ? student.photoKey
          : null,
    };
  }

  async upload(
    studentInternalId: string,
    input: StudentPhotoUploadInput,
  ): Promise<StudentPhotoUploadResult> {
    const student = await this.getStudentPhotoRecord(studentInternalId);
    const mimeType = validateStudentPhoto(input);
    const storage = this.createStorage();
    const objectKey = createStudentPhotoObjectKey(student.id, mimeType);

    await storage.upload(objectKey, input.buffer, mimeType);

    try {
      await this.repo.update(student.id, { photoKey: objectKey });
    } catch (error) {
      try {
        await storage.remove(objectKey);
      } catch (cleanupError) {
        logger.warn(
          { err: cleanupError },
          '[SMS-PHOTO] Uploaded student photo could not be cleaned up after database update failure.',
        );
      }

      throw error;
    }

    if (student.photoKey) {
      try {
        await storage.remove(student.photoKey);
      } catch (cleanupError) {
        logger.warn(
          { err: cleanupError },
          '[SMS-PHOTO] Previous student photo could not be cleaned up after replacement.',
        );
      }
    }

    return { photoAvailable: true };
  }

  async createSignedUrl(studentInternalId: string): Promise<string> {
    const student = await this.getStudentPhotoRecord(studentInternalId);

    if (!student.photoKey) {
      throw new AppError(404, 'Student photo was not found.');
    }

    return this.createStorage().createSignedUrl(student.photoKey);
  }

  async remove(
    studentInternalId: string,
  ): Promise<StudentPhotoDeleteResult> {
    const student = await this.getStudentPhotoRecord(studentInternalId);

    if (!student.photoKey) {
      return { photoAvailable: false };
    }

    const storage = this.createStorage();

    // Clear application access first. A failed object cleanup can leave only an
    // inaccessible private orphan, never a live database reference to a removed file.
    await this.repo.update(student.id, { photoKey: null });

    try {
      await storage.remove(student.photoKey);
    } catch (cleanupError) {
      logger.warn(
        { err: cleanupError },
        '[SMS-PHOTO] Student photo key was cleared but private object cleanup failed.',
      );
    }

    return { photoAvailable: false };
  }
}
