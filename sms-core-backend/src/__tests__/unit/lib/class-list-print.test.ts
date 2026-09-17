import { describe, it, expect } from 'vitest';
import {
  renderClassListPrintHtml,
  normalizeClassListColumns,
  CLASS_LIST_MAX_OPTIONAL_COLUMNS,
} from '@/lib/class-list-print';
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

describe('normalizeClassListColumns (2026-09 selectable columns)', () => {
  it('returns empty for absent or blank input', () => {
    expect(normalizeClassListColumns(undefined)).toEqual([]);
    expect(normalizeClassListColumns('')).toEqual([]);
    expect(normalizeClassListColumns('  , , ')).toEqual([]);
  });

  it('drops unknown keys, trims, dedupes, and keeps canonical order', () => {
    expect(normalizeClassListColumns('feesOwed, gender, bogus, feesOwed, dob')).toEqual([
      'gender',
      'dob',
      'feesOwed',
    ]);
  });

  it('accepts array input (repeated query params)', () => {
    expect(normalizeClassListColumns(['dob', 'gender'])).toEqual(['gender', 'dob']);
  });

  it('caps at the max column count — last catalog entries drop', () => {
    const all = ['studentId', 'gender', 'dob', 'guardian', 'guardianPhone', 'feesOwed'];
    expect(normalizeClassListColumns(all)).toHaveLength(CLASS_LIST_MAX_OPTIONAL_COLUMNS);
    expect(normalizeClassListColumns(['feesOwed', ...all.slice(0, 5)])).toEqual([
      'studentId', 'gender', 'dob', 'guardian', 'guardianPhone',
    ]);
  });
});

describe('renderClassListPrintHtml columns (2026-09)', () => {
  function makeRowData(): ClassListPdfData {
    return {
      className: 'Grade 1B',
      termName: 'First Term',
      academicYear: '2026/2027',
      dateOfIssue: new Date('2026-09-16T09:00:00Z'),
      students: [
        {
          name: 'Akyeabea Kezia Asante',
          studentId: 'JCS-34-041',
          gender: 'Female',
          dob: '2019-05-11T12:00:00.000Z',
          guardian: 'Comfort Mensah',
          guardianPhone: '0240000000',
          feesOwed: 1234.5,
        },
      ],
    };
  }

  it('defaults to studentId + gender (legacy layout)', () => {
    const html = renderClassListPrintHtml(makeRowData());
    expect(html).toContain('STUDENT ID');
    expect(html).toContain('GENDER');
    expect(html).not.toContain('DATE OF BIRTH');
    expect(html).not.toContain('FEES OWED');
  });

  it('renders the selected columns in canonical order with values', () => {
    const html = renderClassListPrintHtml(makeRowData(), ['feesOwed', 'dob', 'guardian']);
    expect(html).toContain('DATE OF BIRTH');
    expect(html).toContain('GUARDIAN');
    expect(html).toContain('FEES OWED');
    expect(html).toContain('11 May 2019');
    expect(html).toContain('Comfort Mensah');
    expect(html).toContain('GHS 1,234.50');
    expect(html).not.toContain('STUDENT ID');
    // canonical order regardless of request order: dob < guardian < feesOwed
    expect(html.indexOf('DATE OF BIRTH')).toBeLessThan(html.indexOf('>GUARDIAN'));
    expect(html.indexOf('>GUARDIAN')).toBeLessThan(html.indexOf('FEES OWED'));
  });

  it('renders dashes for missing optional values', () => {
    const empty: ClassListPdfData = {
      ...makeRowData(),
      students: [{ name: 'X', studentId: 'J', gender: null, dob: null, guardian: null, guardianPhone: null, feesOwed: null }],
    };
    const html = renderClassListPrintHtml(empty, ['dob', 'guardian', 'guardianPhone', 'feesOwed']);
    expect(html).toMatch(/c-dob">—/);
    expect(html).toMatch(/c-guardian">—/);
    expect(html).toMatch(/c-phone">—/);
    expect(html).toMatch(/c-fees">—/);
  });

  it('sizes the empty-roster colspan to the selected columns', () => {
    const html = renderClassListPrintHtml({ ...makeRowData(), students: [] }, ['dob', 'feesOwed']);
    expect(html).toContain('colspan="4"');
  });
});
