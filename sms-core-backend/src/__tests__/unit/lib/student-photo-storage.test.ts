import { describe, expect, it, vi } from 'vitest';
import {
  STUDENT_PHOTO_SIGNED_URL_SECONDS,
  StudentPhotoStorageConfigurationError,
  StudentPhotoStorageOperationError,
  SupabaseStudentPhotoStorage,
  resolveStudentPhotoStorageConfig,
  type StudentPhotoStorageClient,
} from '@/lib/student-photo-storage';

const configuredEnvironment = {
  SUPABASE_URL: 'https://project.example.test',
  SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-key',
  STUDENT_PHOTOS_BUCKET: 'student-photos',
};

describe('student photo storage configuration', () => {
  it('accepts complete private storage configuration without exposing values', () => {
    expect(resolveStudentPhotoStorageConfig(configuredEnvironment)).toEqual({
      url: 'https://project.example.test',
      serviceRoleKey: 'server-only-test-key',
      bucket: 'student-photos',
    });
  });

  it('fails closed when required server-only configuration is missing', () => {
    expect(() =>
      resolveStudentPhotoStorageConfig({
        SUPABASE_URL: 'https://project.example.test',
      }),
    ).toThrow(StudentPhotoStorageConfigurationError);
  });

  it('rejects invalid URLs and bucket names', () => {
    expect(() =>
      resolveStudentPhotoStorageConfig({
        ...configuredEnvironment,
        SUPABASE_URL: 'ftp://project.example.test',
      }),
    ).toThrow('invalid SUPABASE_URL');

    expect(() =>
      resolveStudentPhotoStorageConfig({
        ...configuredEnvironment,
        STUDENT_PHOTOS_BUCKET: '../public',
      }),
    ).toThrow('invalid STUDENT_PHOTOS_BUCKET');
  });
});

describe('SupabaseStudentPhotoStorage', () => {
  function createClient() {
    const upload = vi.fn().mockResolvedValue({ data: { path: 'ok' }, error: null });
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.example.test/signed-photo' },
      error: null,
    });

    const client: StudentPhotoStorageClient = {
      storage: {
        from: vi.fn().mockReturnValue({ upload, remove, createSignedUrl }),
      },
    };

    return { client, upload, remove, createSignedUrl };
  }

  it('uses a private bucket for upload, deletion, and short-lived signed URLs', async () => {
    const { client, upload, remove, createSignedUrl } = createClient();

    const storage = new SupabaseStudentPhotoStorage(
      {
        url: configuredEnvironment.SUPABASE_URL,
        serviceRoleKey: configuredEnvironment.SUPABASE_SERVICE_ROLE_KEY,
        bucket: configuredEnvironment.STUDENT_PHOTOS_BUCKET,
      },
      client,
    );

    await storage.upload('student-1/photo-1.png', Buffer.from([1]), 'image/png');
    await storage.remove('student-1/photo-1.png');
    const signedUrl = await storage.createSignedUrl('student-1/photo-1.png');

    expect(upload).toHaveBeenCalledWith(
      'student-1/photo-1.png',
      expect.any(Buffer),
      {
        cacheControl: '31536000',
        contentType: 'image/png',
        upsert: false,
      },
    );
    expect(remove).toHaveBeenCalledWith(['student-1/photo-1.png']);
    expect(createSignedUrl).toHaveBeenCalledWith(
      'student-1/photo-1.png',
      STUDENT_PHOTO_SIGNED_URL_SECONDS,
    );
    expect(signedUrl).toContain('/signed-photo');
  });

  it('converts private storage failures into controlled errors', async () => {
    const { client } = createClient();

    client.storage.from = vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'bucket unavailable' },
      }),
      remove: vi.fn(),
      createSignedUrl: vi.fn(),
    });

    const storage = new SupabaseStudentPhotoStorage(
      {
        url: configuredEnvironment.SUPABASE_URL,
        serviceRoleKey: configuredEnvironment.SUPABASE_SERVICE_ROLE_KEY,
        bucket: configuredEnvironment.STUDENT_PHOTOS_BUCKET,
      },
      client,
    );

    await expect(
      storage.upload('student-1/photo-1.png', Buffer.from([1]), 'image/png'),
    ).rejects.toBeInstanceOf(StudentPhotoStorageOperationError);
  });
});
