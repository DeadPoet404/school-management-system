import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    student: { findUnique: vi.fn() },
    gradeRecord: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { renderTranscriptPdf, type TranscriptPdfData, type TranscriptTermSection } from '@/lib/pdf';
import { StudentService } from '@/modules/students/student.service';

function makeRow(subject: string, code: string, gp: number, ch: number) {
  return { subject, code, caScore: 28, examScore: 56, finalScore: 84, letterGrade: 'A', gradePoints: gp, creditHours: ch };
}

function makeDto(termCount: number, rowsPerTerm: number): TranscriptPdfData {
  const terms: TranscriptTermSection[] = [];
  for (let t = 0; t < termCount; t++) {
    const rows = [];
    for (let r = 0; r < rowsPerTerm; r++) rows.push(makeRow(`Subject ${t}-${r}`, `S${t}${r}`, 3.5, 3));
    terms.push({ termName: `Term ${t + 1}`, academicYear: '2025/2026', rows, termGpa: 3.5, creditHours: rowsPerTerm * 3 });
  }
  return {
    studentName: 'Kofi Boateng',
    studentCode: 'HHA-2024-0007',
    className: 'JHS 2A — Section A',
    enrollmentDate: new Date('2024-09-01T00:00:00.000Z'),
    dateOfIssue: new Date('2026-08-05T10:00:00.000Z'),
    terms,
    cumulativeGpa: 3.42,
  };
}

describe('renderTranscriptPdf (SMS-008)', () => {
  it('produces a non-empty %PDF buffer', async () => {
    const buf = await renderTranscriptPdf(makeDto(2, 6));
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(800);
  });

  it('stamps searchable document metadata', async () => {
    const text = (await renderTranscriptPdf(makeDto(2, 6))).toString('latin1');
    expect(text).toContain('OFFICIAL ACADEMIC TRANSCRIPT');
    expect(text).toContain('Kofi Boateng');
    expect(text).toContain('HHA-2024-0007');
  });

  it('paginates long multi-term transcripts across multiple pages', async () => {
    // 8 terms x 12 rows must exceed a single A4 page.
    const buf = await renderTranscriptPdf(makeDto(8, 12));
    const pageCount = (buf.toString('latin1').match(/\/Type \/Page(?!s)/g) ?? []).length;
    expect(pageCount).toBeGreaterThanOrEqual(2);
  });

  it('renders gracefully when the student has no grade records', async () => {
    const buf = await renderTranscriptPdf({ ...makeDto(0, 0), cumulativeGpa: null });
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(500);
  });
});

describe('StudentService.getTranscriptForPdf (SMS-008)', () => {
  const service = new StudentService();

  const studentRow = {
    id: 'stu-1',
    studentId: 'HHA-2024-0007',
    studentName: 'Kofi Boateng',
    enrollmentDate: new Date('2024-09-01T00:00:00.000Z'),
    currentGpa: 3.42,
    placement: { class: { name: 'JHS 2A', section: 'A' } },
  };

  const rec = (termName: string, startDate: string, subject: string, code: string, gp: number, ch: number) => ({
    continuousAssessment: 28,
    examination: 56,
    finalScore: 84,
    letterGrade: 'A',
    gradePoints: gp,
    creditHours: ch,
    subject: { name: subject, code },
    term: { name: termName, academicYear: '2025/2026', startDate: new Date(startDate) },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.student.findUnique.mockResolvedValue(studentRow);
    prismaMock.gradeRecord.findMany.mockResolvedValue([
      rec('Term 1', '2025-09-01', 'English Language', 'ENG', 3.0, 3),
      rec('Term 1', '2025-09-01', 'Mathematics', 'MTH', 4.0, 3),
      rec('Term 2', '2026-01-06', 'Integrated Science', 'SCI', 3.6, 5),
    ]);
  });

  it('groups records into ordered terms with weighted GPA per term', async () => {
    const dto = await service.getTranscriptForPdf('stu-1');
    expect(dto.terms).toHaveLength(2);
    expect(dto.terms[0]!.termName).toBe('Term 1');
    expect(dto.terms[1]!.termName).toBe('Term 2');
    // Term 1: (3.0*3 + 4.0*3) / 6 = 3.50
    expect(dto.terms[0]!.termGpa).toBe(3.5);
    expect(dto.terms[0]!.creditHours).toBe(6);
    // Term 2: single course -> its own points
    expect(dto.terms[1]!.termGpa).toBe(3.6);
  });

  it('maps identity, class composition, and the stored cumulative GPA', async () => {
    const dto = await service.getTranscriptForPdf('stu-1');
    expect(dto.studentCode).toBe('HHA-2024-0007');
    expect(dto.className).toBe('JHS 2A — Section A');
    expect(dto.cumulativeGpa).toBe(3.42);
    expect(dto.terms[0]!.rows[0]).toEqual(makeRow('English Language', 'ENG', 3.0, 3));
  });

  it('returns an empty transcript with null GPA when no records exist', async () => {
    prismaMock.gradeRecord.findMany.mockResolvedValue([]);
    const dto = await service.getTranscriptForPdf('stu-1');
    expect(dto.terms).toEqual([]);
    expect(dto.cumulativeGpa).toBeNull();
  });

  it('throws 404 for an unknown student', async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    await expect(service.getTranscriptForPdf('ghost')).rejects.toMatchObject({ statusCode: 404 });
  });
});
