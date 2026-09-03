/**
 * Cohort-based student identifiers.
 *
 * Format: JCS-<2-digit JHS3 completion year>-<3-digit sequence>
 *   e.g. JCS-39-014
 *
 * The code encodes the year the student is due to FINISH JHS 3, not their
 * current class. Promotion therefore never rewrites an ID, so receipts,
 * invoices and transcripts stay valid for life. Two students sharing a
 * cohort code are in the same year group, permanently.
 *
 * Reading it: cohortYear - currentAcademicYear = years remaining.
 *   JCS-32-014 in 2026 -> 6 years left -> Grade 3.
 */

export const ID_PREFIX = 'JCS';

/**
 * Years of schooling remaining once a student is IN the given class,
 * counted to the end of JHS 3. A JHS 3 pupil has 0 remaining.
 * Sections (A/B) share a rung: they are the same year group.
 */
export const YEARS_TO_COMPLETION: Record<string, number> = {
  'Creche': 13,
  'Nursery 1A': 12, 'Nursery 1B': 12,
  'Nursery 2A': 11, 'Nursery 2B': 11,
  'KG 1A': 10, 'KG 1B': 10,
  'KG 2A': 9, 'KG 2B': 9,
  'Grade 1A': 8, 'Grade 1B': 8,
  'Grade 2A': 7, 'Grade 2B': 7,
  'Grade 3A': 6, 'Grade 3B': 6,
  'Grade 4A': 5, 'Grade 4B': 5,
  'Grade 5A': 4, 'Grade 5B': 4,
  'Grade 6A': 3, 'Grade 6B': 3,
  'JHS 1A': 2, 'JHS 1B': 2,
  'JHS 2A': 1, 'JHS 2B': 1,
  'JHS 3A': 0, 'JHS 3B': 0,
};

/**
 * The academic year a date falls in. Ghanaian school years start in
 * September, so 2026-10-01 and 2027-03-01 are both academic year 2026.
 */
export function academicYearOf(date: Date): number {
  const y = date.getUTCFullYear();
  // getUTCMonth() is 0-based; 8 === September.
  return date.getUTCMonth() >= 8 ? y : y - 1;
}

/**
 * Cohort (JHS 3 completion year) for a student currently sitting in
 * `className` during `academicYear`. Returns null for unrecognised
 * classes so callers can refuse rather than guess a child's year group.
 */
export function cohortForClass(className: string, academicYear: number): number | null {
  const remaining = YEARS_TO_COMPLETION[className.trim()];
  if (remaining === undefined) return null;
  return academicYear + remaining;
}

/** Render a full student ID from its parts. */
export function formatStudentId(cohortYear: number, sequence: number): string {
  const yy = String(cohortYear % 100).padStart(2, '0');
  const seq = String(sequence).padStart(3, '0');
  return `${ID_PREFIX}-${yy}-${seq}`;
}

/** Inverse of formatStudentId. Returns null when the string is not ours. */
export function parseStudentId(
  id: string
): { cohortYear: number; sequence: number } | null {
  const m = /^JCS-(\d{2})-(\d{3,})$/.exec(id.trim());
  if (!m) return null;
  // Two-digit years map into 2000-2099; the ladder only reaches ~14 years out.
  return { cohortYear: 2000 + Number(m[1]), sequence: Number(m[2]) };
}

/**
 * Years remaining for a cohort as of an academic year. Negative means the
 * student has already completed JHS 3.
 */
export function yearsRemaining(cohortYear: number, academicYear: number): number {
  return cohortYear - academicYear;
}

/** Human label for a cohort, for UI badges: "Class of 2040". */
export function cohortLabel(cohortYear: number): string {
  return `Class of ${cohortYear}`;
}
