import { createClient } from '@supabase/supabase-js';
import type { StudentPhotoMime } from './student-photo';

export const STUDENT_PHOTO_STORAGE_URL_ENV = 'SUPABASE_URL';
export const STUDENT_PHOTO_STORAGE_KEY_ENV = 'SUPABASE_SERVICE_ROLE_KEY';
export const STUDENT_PHOTO_STORAGE_BUCKET_ENV = 'STUDENT_PHOTOS_BUCKET';

export const STUDENT_PHOTO_SIGNED_URL_SECONDS = 5 * 60;

export type StudentPhotoStorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

type StorageResult<T> = {
  data: T | null;
  error: { message?: string } | null;
};

export type StudentPhotoBucketClient = {
  upload: (
    key: string,
    body: Buffer,
    options: {
      cacheControl: string;
      contentType: StudentPhotoMime;
      upsert: boolean;
    },
  ) => Promise<StorageResult<{ path: string }>>;
  remove: (keys: string[]) => Promise<StorageResult<unknown>>;
  createSignedUrl: (
    key: string,
    expiresIn: number,
  ) => Promise<StorageResult<{ signedUrl: string }>>;
};

export type StudentPhotoStorageClient = {
  storage: {
    from: (bucket: string) => StudentPhotoBucketClient;
  };
};

export class StudentPhotoStorageConfigurationError extends Error {
  readonly code = 'STUDENT_PHOTO_STORAGE_NOT_CONFIGURED';

  constructor(message: string) {
    super(message);
    this.name = 'StudentPhotoStorageConfigurationError';
  }
}

export class StudentPhotoStorageOperationError extends Error {
  readonly code = 'STUDENT_PHOTO_STORAGE_OPERATION_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'StudentPhotoStorageOperationError';
  }
}

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isSafeBucketName(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(value);
}

export function resolveStudentPhotoStorageConfig(
  environment: NodeJS.ProcessEnv = process.env,
): StudentPhotoStorageConfig {
  const url = nonEmpty(environment[STUDENT_PHOTO_STORAGE_URL_ENV]);
  const serviceRoleKey = nonEmpty(
    environment[STUDENT_PHOTO_STORAGE_KEY_ENV],
  );
  const bucket = nonEmpty(
    environment[STUDENT_PHOTO_STORAGE_BUCKET_ENV],
  );

  const missing = [
    !url ? STUDENT_PHOTO_STORAGE_URL_ENV : null,
    !serviceRoleKey ? STUDENT_PHOTO_STORAGE_KEY_ENV : null,
    !bucket ? STUDENT_PHOTO_STORAGE_BUCKET_ENV : null,
  ].filter((value): value is string => Boolean(value));

  if (missing.length > 0) {
    throw new StudentPhotoStorageConfigurationError(
      `Student photo storage is not configured: missing ${missing.join(', ')}.`,
    );
  }

  // The runtime missing-value guard above is authoritative. TypeScript does
  // not infer that fact through a filtered array, so form the guaranteed
  // non-null configuration object explicitly at this boundary.
  const config: StudentPhotoStorageConfig = {
    url: url as string,
    serviceRoleKey: serviceRoleKey as string,
    bucket: bucket as string,
  };

  try {
    const parsedUrl = new URL(config.url);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      throw new Error('Unsupported protocol.');
    }
  } catch {
    throw new StudentPhotoStorageConfigurationError(
      'Student photo storage has an invalid SUPABASE_URL.',
    );
  }

  if (!isSafeBucketName(config.bucket)) {
    throw new StudentPhotoStorageConfigurationError(
      'Student photo storage has an invalid STUDENT_PHOTOS_BUCKET.',
    );
  }

  return config;
}

function operationMessage(
  fallback: string,
  error: { message?: string } | null,
): string {
  const detail = error?.message?.trim();
  return detail ? `${fallback}: ${detail}` : fallback;
}

export class SupabaseStudentPhotoStorage {
  constructor(
    private readonly config: StudentPhotoStorageConfig,
    private readonly client: StudentPhotoStorageClient,
  ) {}

  async upload(
    objectKey: string,
    buffer: Buffer,
    mimeType: StudentPhotoMime,
  ): Promise<void> {
    const { error } = await this.client.storage
      .from(this.config.bucket)
      .upload(objectKey, buffer, {
        cacheControl: '31536000',
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      throw new StudentPhotoStorageOperationError(
        operationMessage('Unable to upload student photo', error),
      );
    }
  }

  async remove(objectKey: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.config.bucket)
      .remove([objectKey]);

    if (error) {
      throw new StudentPhotoStorageOperationError(
        operationMessage('Unable to remove student photo', error),
      );
    }
  }

  async createSignedUrl(
    objectKey: string,
    expiresIn: number = STUDENT_PHOTO_SIGNED_URL_SECONDS,
  ): Promise<string> {
    if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 3600) {
      throw new StudentPhotoStorageOperationError(
        'Student photo signed URL expiry must be between 1 and 3600 seconds.',
      );
    }

    const { data, error } = await this.client.storage
      .from(this.config.bucket)
      .createSignedUrl(objectKey, expiresIn);

    if (error || !data?.signedUrl) {
      throw new StudentPhotoStorageOperationError(
        operationMessage('Unable to create student photo signed URL', error),
      );
    }

    return data.signedUrl;
  }
}

/**
 * Creates a private server-only Storage client on demand.
 *
 * This function must never be called from frontend code and must not be called
 * during backend bootstrap, so an absent optional Storage configuration cannot
 * break unrelated management operations.
 */
export function createStudentPhotoStorage(
  environment: NodeJS.ProcessEnv = process.env,
): SupabaseStudentPhotoStorage {
  const config = resolveStudentPhotoStorageConfig(environment);

  const client = createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as unknown as StudentPhotoStorageClient;

  return new SupabaseStudentPhotoStorage(config, client);
}
