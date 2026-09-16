import { describe, it, expect } from 'vitest';
import { renderClassListPdf, titleCaseTerm, type ClassListPdfData } from '@/lib/pdf';

function makeDto(count: number): ClassListPdfData {
  return {
    className: 'Grade 1B',
    termName: 'First Term',
    academicYear: '2026/2027',
    dateOfIssue: new Date('2026-09-16T09:00:00Z'),
    students: Array.from({ length: count }, (_, i) => ({
      name: `Student Number ${String(i + 1).padStart(2, '0')}`,
      studentId: `JCS-34-${String(i + 1).padStart(3, '0')}`,
      gender: i % 3 === 2 ? null : i % 2 === 0 ? 'Female' : 'Male',
    })),
  };
}

function pageCountOf(buf: Buffer): number {
  return (buf.toString('latin1').match(/\/Type \/Page(?!s)/g) ?? []).length;
}

describe('titleCaseTerm', () => {
  it('title-cases upper-snake term names', () => {
    expect(titleCaseTerm('FIRST TERM')).toBe('First Term');
    expect(titleCaseTerm('THIRD')).toBe('Third');
  });
});

describe('renderClassListPdf (SMS-009)', () => {
  it('produces a non-empty %PDF buffer', async () => {
    const buf = await renderClassListPdf(makeDto(12));
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(800);
  });

  it('stamps searchable document metadata', async () => {
    const text = (await renderClassListPdf(makeDto(12))).toString('latin1');
    expect(text).toContain('Class List - Grade 1B');
    expect(text).toContain('2026/2027 First Term');
    expect(text).toContain('students:12');
  });

  it('fits a small class on a single page', async () => {
    const buf = await renderClassListPdf(makeDto(8));
    expect(pageCountOf(buf)).toBe(1);
  });

  it('paginates a large class across multiple pages', async () => {
    // 45 rows cannot fit under the letterhead on one A4 page.
    const buf = await renderClassListPdf(makeDto(45));
    expect(pageCountOf(buf)).toBeGreaterThanOrEqual(2);
  });

  it('renders an empty roster without throwing', async () => {
    const buf = await renderClassListPdf(makeDto(0));
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pageCountOf(buf)).toBe(1);
  });
});
