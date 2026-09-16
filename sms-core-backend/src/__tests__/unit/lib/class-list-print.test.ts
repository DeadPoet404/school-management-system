import { describe, it, expect } from 'vitest';
import { renderClassListPrintHtml } from '@/lib/class-list-print';
import type { ClassListPdfData } from '@/lib/pdf';

function makeDto(count: number): ClassListPdfData {
  return {
    className: 'Grade 1B',
    termName: 'First Term',
    academicYear: '2026/2027',
    dateOfIssue: new Date('2026-09-16T09:00:00Z'),
    students: Array.from({ length: count }, (_, i) => ({
      name: i === 0 ? `O'Neil <Tricky> "Name"` : `Student Number ${String(i + 1).padStart(2, '0')}`,
      studentId: `JCS-34-${String(i + 1).padStart(3, '0')}`,
      gender: i % 3 === 2 ? null : i % 2 === 0 ? 'Female' : 'Male',
    })),
  };
}

describe('renderClassListPrintHtml (SMS-009b)', () => {
  it('renders the letterhead, roster and native print trigger', () => {
    const html = renderClassListPrintHtml(makeDto(3));
    expect(html).toContain('JOCOMFY SCHOOL');
    expect(html).toContain('/branding/jocomfy-school-logo.png');
    expect(html).toContain('GRADE 1B');
    expect(html).toContain('2026/2027 Academic Year — First Term');
    expect(html).toContain('O&#39;Neil &lt;Tricky&gt; &quot;Name&quot;');
    expect(html).toContain('JCS-34-001');
    expect(html).toContain('window.print()');
    expect(html).toContain('@page { size: A4 portrait');
  });

  it('renders a gender dash for missing values', () => {
    const html = renderClassListPrintHtml(makeDto(3));
    // student index 2 has null gender
    expect(html).toMatch(/c-gender">—/);
  });

  it('renders an empty-roster notice instead of rows', () => {
    const html = renderClassListPrintHtml(makeDto(0));
    expect(html).toContain('No active students in this class yet.');
    expect(html).toContain('<b>0</b>');
  });
});
