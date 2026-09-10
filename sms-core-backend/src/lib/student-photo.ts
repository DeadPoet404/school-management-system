import { randomUUID } from 'node:crypto';

export const MAX_STUDENT_PHOTO_BYTES = 5 * 1024 * 1024;

export const STUDENT_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type StudentPhotoMime = (typeof STUDENT_PHOTO_MIME_TYPES)[number];

export type StudentPhotoUploadInput = {
  buffer: Buffer;
  declaredMimeType?: string | null;
};

export class StudentPhotoValidationError extends Error {
  readonly code = 'INVALID_STUDENT_PHOTO';

  constructor(message: string) {
    super(message);
    this.name = 'StudentPhotoValidationError';
  }
}

function startsWith(buffer: Buffer, signature: number[]): boolean {
  return signature.every((value, index) => buffer[index] === value);
}

export function detectStudentPhotoMime(buffer: Buffer): StudentPhotoMime | null {
  if (buffer.length >= 3 && startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 8 &&
    startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return 'image/png';
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

export function validateStudentPhoto(
  input: StudentPhotoUploadInput,
): StudentPhotoMime {
  if (!input.buffer.length) {
    throw new StudentPhotoValidationError('Student photo upload is empty.');
  }

  if (input.buffer.length > MAX_STUDENT_PHOTO_BYTES) {
    throw new StudentPhotoValidationError(
      'Student photo must not exceed 5 MB.',
    );
  }

  const detectedMimeType = detectStudentPhotoMime(input.buffer);

  if (!detectedMimeType) {
    throw new StudentPhotoValidationError(
      'Student photo must be a valid JPEG, PNG, or WebP image.',
    );
  }

  const declaredMimeType = input.declaredMimeType?.trim().toLowerCase();

  if (
    declaredMimeType &&
    !STUDENT_PHOTO_MIME_TYPES.includes(
      declaredMimeType as StudentPhotoMime,
    )
  ) {
    throw new StudentPhotoValidationError(
      'Student photo content type must be JPEG, PNG, or WebP.',
    );
  }

  if (declaredMimeType && declaredMimeType !== detectedMimeType) {
    throw new StudentPhotoValidationError(
      'Student photo content type does not match its image data.',
    );
  }

  return detectedMimeType;
}

export function studentPhotoExtension(mimeType: StudentPhotoMime): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
  }
}

export function createStudentPhotoObjectKey(
  studentInternalId: string,
  mimeType: StudentPhotoMime,
  randomId: () => string = randomUUID,
): string {
  if (!/^[A-Za-z0-9-]{1,128}$/.test(studentInternalId)) {
    throw new StudentPhotoValidationError(
      'Student photo key cannot be generated for an invalid student ID.',
    );
  }

  const suffix = randomId();

  if (!/^[A-Za-z0-9-]{1,128}$/.test(suffix)) {
    throw new StudentPhotoValidationError(
      'Student photo key generator returned an invalid identifier.',
    );
  }

  return `${studentInternalId}/photo-${suffix}.${studentPhotoExtension(mimeType)}`;
}
