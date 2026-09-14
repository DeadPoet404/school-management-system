import { describe, expect, it } from 'vitest';
import { parseStudentImportFile } from '@/modules/students/student.import';

const HEADER =
  'fullName,email,dateOfBirth,gender,residentialAddress,class,feeTier,guardianName,guardianRelationship,guardianPhone,regNo,enrollmentDate,formerSchool';

function parseCsv(rows: string[]) {
  const csv = [HEADER, ...rows].join('\n');
  return parseStudentImportFile({
    buffer: Buffer.from(csv, 'utf8'),
    originalname: 'students.csv',
    mimetype: 'text/csv',
    size: Buffer.byteLength(csv),
  });
}

const ROW = [
  'JANE DOW',
  'jane@example.com',
  '2018-05-01',
  'Female',
  'Accra',
  'Grade 1A',
  'STD-GRADE1A',
  'Mr. Dow',
  'FATHER',
  '0244000000',
  'JCS-0101',
  '2026-09-01',
  'Some School',
].join(',');

describe('student import — legacyStudentId', () => {
  it('maps the regNo column to payload.legacyStudentId', () => {
    const result = parseCsv([ROW]);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows.map((row) => row.payload.legacyStudentId)).toEqual(['JCS-0101']);
  });

  it('maps the legacyStudentId column name itself as well', () => {
    const csv = [
      HEADER.replace('regNo', 'legacyStudentId'),
      ROW,
    ].join('\n');
    const result = parseStudentImportFile({
      buffer: Buffer.from(csv, 'utf8'),
      originalname: 'students.csv',
      mimetype: 'text/csv',
      size: Buffer.byteLength(csv),
    });
    expect(result.errors).toEqual([]);
    expect(result.rows.map((row) => row.payload.legacyStudentId)).toEqual(['JCS-0101']);
  });

  it('leaves legacyStudentId null when the column is absent', () => {
    const csv = [
      HEADER.replace(',regNo', ''),
      ROW.replace(',JCS-0101', ''),
    ].join('\n');
    const result = parseStudentImportFile({
      buffer: Buffer.from(csv, 'utf8'),
      originalname: 'students.csv',
      mimetype: 'text/csv',
      size: Buffer.byteLength(csv),
    });
    expect(result.errors).toEqual([]);
    expect(result.rows.map((row) => row.payload.legacyStudentId)).toEqual([null]);
  });
});
