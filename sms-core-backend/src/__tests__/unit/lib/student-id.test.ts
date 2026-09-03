import { describe, it, expect } from 'vitest';
import {
  academicYearOf,
  cohortForClass,
  formatStudentId,
  parseStudentId,
  yearsRemaining,
  cohortLabel,
  YEARS_TO_COMPLETION,
} from '@/lib/student-id';

describe('academicYearOf', () => {
  it('treats September onward as the new academic year', () => {
    expect(academicYearOf(new Date('2026-09-01T00:00:00Z'))).toBe(2026);
    expect(academicYearOf(new Date('2026-12-31T00:00:00Z'))).toBe(2026);
  });

  it('treats January to August as the previous academic year', () => {
    expect(academicYearOf(new Date('2027-01-15T00:00:00Z'))).toBe(2026);
    expect(academicYearOf(new Date('2027-08-31T00:00:00Z'))).toBe(2026);
  });
});

describe('cohortForClass', () => {
  it('maps a 2026 Creche intake to the class of 2039', () => {
    expect(cohortForClass('Creche', 2026)).toBe(2039);
  });

  it('maps 2026 JHS 3 to the class of 2026 (finishing now)', () => {
    expect(cohortForClass('JHS 3A', 2026)).toBe(2026);
  });

  it('gives sections of the same year group an identical cohort', () => {
    expect(cohortForClass('Grade 3A', 2026)).toBe(cohortForClass('Grade 3B', 2026));
  });

  it('matches the worked example: Grade 3 in 2026 is the class of 2032', () => {
    expect(cohortForClass('Grade 3A', 2026)).toBe(2032);
  });

  it('returns null for an unrecognised class rather than guessing', () => {
    expect(cohortForClass('Primary 3', 2026)).toBeNull();
    expect(cohortForClass('Unassigned', 2026)).toBeNull();
  });

  it('covers every rung of the canonical 27-class ladder', () => {
    // 1 Creche + 26 sectioned classes
    expect(Object.keys(YEARS_TO_COMPLETION)).toHaveLength(27);
  });

  it('advances the cohort by one for each later intake year', () => {
    expect(cohortForClass('Creche', 2027)).toBe(2040);
  });
});

describe('formatStudentId', () => {
  it('zero-pads the cohort and sequence', () => {
    expect(formatStudentId(2039, 14)).toBe('JCS-39-014');
    expect(formatStudentId(2032, 1)).toBe('JCS-32-001');
  });

  it('handles a cohort in the 2100s wrapping to two digits', () => {
    expect(formatStudentId(2026, 499)).toBe('JCS-26-499');
  });

  it('does not truncate sequences beyond 999', () => {
    expect(formatStudentId(2039, 1234)).toBe('JCS-39-1234');
  });
});

describe('parseStudentId', () => {
  it('round-trips with formatStudentId', () => {
    const id = formatStudentId(2039, 14);
    expect(parseStudentId(id)).toEqual({ cohortYear: 2039, sequence: 14 });
  });

  it('rejects the legacy formats', () => {
    expect(parseStudentId('JCS-0227')).toBeNull();
    expect(parseStudentId('STU-2026-v2sghh')).toBeNull();
  });

  it('rejects near-misses', () => {
    expect(parseStudentId('JCS-39-14')).toBeNull();
    expect(parseStudentId('ABC-39-014')).toBeNull();
  });
});

describe('yearsRemaining', () => {
  it('reads the grade back out of a cohort code', () => {
    expect(yearsRemaining(2039, 2026)).toBe(13); // Creche
    expect(yearsRemaining(2032, 2026)).toBe(6);  // Grade 3
    expect(yearsRemaining(2026, 2026)).toBe(0);  // JHS 3
  });

  it('goes negative for alumni', () => {
    expect(yearsRemaining(2026, 2028)).toBe(-2);
  });

  it('stays stable across a promotion: same ID, one year closer', () => {
    const cohort = cohortForClass('Grade 3A', 2026)!;
    expect(yearsRemaining(cohort, 2026)).toBe(6);
    expect(yearsRemaining(cohort, 2027)).toBe(5); // now Grade 4, ID unchanged
  });
});

describe('cohortLabel', () => {
  it('renders a human badge', () => {
    expect(cohortLabel(2039)).toBe('Class of 2039');
  });
});
