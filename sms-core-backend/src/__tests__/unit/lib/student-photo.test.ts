import { describe, expect, it } from 'vitest';
import {
  MAX_STUDENT_PHOTO_BYTES,
  StudentPhotoValidationError,
  createStudentPhotoObjectKey,
  detectStudentPhotoMime,
  validateStudentPhoto,
} from '@/lib/student-photo';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const webp = Buffer.from([
  0x52, 0x49, 0x46, 0x46,
  0x10, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
]);

describe('student photo validation', () => {
  it.each([
    [jpeg, 'image/jpeg'],
    [png, 'image/png'],
    [webp, 'image/webp'],
  ] as const)('detects valid %s image bytes', (buffer, expectedMimeType) => {
    expect(detectStudentPhotoMime(buffer)).toBe(expectedMimeType);
  });

  it('rejects unknown image bytes', () => {
    expect(detectStudentPhotoMime(Buffer.from('not-an-image'))).toBeNull();
  });

  it('rejects a declared MIME type that does not match the image bytes', () => {
    expect(() =>
      validateStudentPhoto({
        buffer: png,
        declaredMimeType: 'image/jpeg',
      }),
    ).toThrow(StudentPhotoValidationError);
  });

  it('rejects unsupported or oversized uploads', () => {
    const oversizedPng = Buffer.concat([
      png,
      Buffer.alloc(MAX_STUDENT_PHOTO_BYTES),
    ]);

    expect(() =>
      validateStudentPhoto({
        buffer: Buffer.from('not-an-image'),
        declaredMimeType: 'application/pdf',
      }),
    ).toThrow('Student photo must be a valid JPEG, PNG, or WebP image.');

    expect(() =>
      validateStudentPhoto({
        buffer: oversizedPng,
        declaredMimeType: 'image/png',
      }),
    ).toThrow('Student photo must not exceed 5 MB.');
  });

  it('creates a safe opaque key rather than a public URL', () => {
    expect(
      createStudentPhotoObjectKey(
        'student-123',
        'image/png',
        () => 'upload-456',
      ),
    ).toBe('student-123/photo-upload-456.png');

    expect(() =>
      createStudentPhotoObjectKey('../student', 'image/png'),
    ).toThrow(StudentPhotoValidationError);
  });
});
