import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/middleware/error.handler';
import type { IStudentRepository } from '@/types/repositories';
import {
  StudentPhotoStorageConfigurationError,
  type SupabaseStudentPhotoStorage,
} from '@/lib/student-photo-storage';
import { StudentPhotoService } from '@/modules/students/student-photo.service';

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

type TestStorage = Pick<
  SupabaseStudentPhotoStorage,
  'upload' | 'remove' | 'createSignedUrl'
>;

function createRepository(
  student: { id: string; photoKey: string | null } | null = {
    id: 'student-1',
    photoKey: null,
  },
) {
  return {
    findById: vi.fn().mockResolvedValue(student),
    update: vi.fn().mockResolvedValue(student),
  } as unknown as IStudentRepository & {
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

function createStorage() {
  const storage: TestStorage = {
    upload: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    createSignedUrl: vi.fn().mockResolvedValue(
      'https://storage.example.test/signed/photo.png',
    ),
  };

  return storage;
}

describe('StudentPhotoService', () => {
  it('uploads a validated private image and stores only an opaque object key', async () => {
    const repo = createRepository();
    const storage = createStorage();
    const service = new StudentPhotoService(repo, () => storage);

    const result = await service.upload('student-1', {
      buffer: png,
      declaredMimeType: 'image/png',
    });

    expect(result).toEqual({ photoAvailable: true });
    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^student-1\/photo-[A-Za-z0-9-]+\.png$/),
      png,
      'image/png',
    );
    expect(repo.update).toHaveBeenCalledWith(
      'student-1',
      expect.objectContaining({
        photoKey: expect.stringMatching(/^student-1\/photo-[A-Za-z0-9-]+\.png$/),
      }),
    );
  });

  it('removes the former private object after a successful replacement', async () => {
    const repo = createRepository({
      id: 'student-1',
      photoKey: 'student-1/photo-old.png',
    });
    const storage = createStorage();
    const service = new StudentPhotoService(repo, () => storage);

    await service.upload('student-1', {
      buffer: png,
      declaredMimeType: 'image/png',
    });

    expect(storage.remove).toHaveBeenCalledWith('student-1/photo-old.png');
  });

  it('cleans up the newly uploaded object if the database update fails', async () => {
    const repo = createRepository();
    repo.update.mockRejectedValueOnce(new Error('database unavailable'));

    const storage = createStorage();
    const service = new StudentPhotoService(repo, () => storage);

    await expect(
      service.upload('student-1', {
        buffer: png,
        declaredMimeType: 'image/png',
      }),
    ).rejects.toThrow('database unavailable');

    const uploadedKey = (
      storage.upload as ReturnType<typeof vi.fn>
    ).mock.calls[0]![0] as string;

    expect(storage.remove).toHaveBeenCalledWith(uploadedKey);
  });

  it('returns a signed URL only when a student has a stored photo key', async () => {
    const repo = createRepository({
      id: 'student-1',
      photoKey: 'student-1/photo-existing.png',
    });
    const storage = createStorage();
    const service = new StudentPhotoService(repo, () => storage);

    await expect(service.createSignedUrl('student-1')).resolves.toBe(
      'https://storage.example.test/signed/photo.png',
    );

    expect(storage.createSignedUrl).toHaveBeenCalledWith(
      'student-1/photo-existing.png',
    );
  });

  it('returns 404 when a photo is unavailable', async () => {
    const repo = createRepository({
      id: 'student-1',
      photoKey: null,
    });
    const service = new StudentPhotoService(repo, createStorage);

    await expect(service.createSignedUrl('student-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('clears the key before removing the private object', async () => {
    const repo = createRepository({
      id: 'student-1',
      photoKey: 'student-1/photo-existing.png',
    });
    const storage = createStorage();
    const service = new StudentPhotoService(repo, () => storage);

    await expect(service.remove('student-1')).resolves.toEqual({
      photoAvailable: false,
    });

    expect(repo.update).toHaveBeenCalledWith('student-1', {
      photoKey: null,
    });
    expect(storage.remove).toHaveBeenCalledWith(
      'student-1/photo-existing.png',
    );
  });

  it('maps absent Storage configuration to controlled 503 response semantics', async () => {
    const repo = createRepository();
    const service = new StudentPhotoService(repo, () => {
      throw new StudentPhotoStorageConfigurationError(
        'Student photo storage is not configured.',
      );
    });

    await expect(
      service.upload('student-1', {
        buffer: png,
        declaredMimeType: 'image/png',
      }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      service.upload('student-1', {
        buffer: png,
        declaredMimeType: 'image/png',
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});
