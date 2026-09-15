/**
 * Shared fee-allocation vocabulary.
 *
 * Three core fee rows carry FIXED canonical names (Admin directive
 * 2026-09): Admission Fee, School Uniform, Termly Tuition. Anything else
 * (row 4+ in the fee structure) is a school-defined extra expense and
 * keeps its free-form name.
 *
 * The core rows are matched BY MEANING, never by row position — the stored
 * row order in the database varies by class (e.g. Termly Tuition may be
 * row 1), and amounts must always stay attached to the right name.
 *
 * The enrollment umbrella is the allocation label for first-term payments
 * made by NEW enrollees (including the initial deposit recorded at
 * enrollment). Receipts generated for a collection allocated to it render
 * the class first-term fee breakdown instead of a single line.
 */
export const CANONICAL_FIRST_COMPONENTS = [
  'Admission Fee',
  'School Uniform',
  'Termly Tuition',
] as const;

export const ENROLLMENT_UMBRELLA =
  'First Term Enrollment (Admission + Uniform + Tuition)';

const CANONICAL_MATCHERS: ReadonlyArray<{
  label: (typeof CANONICAL_FIRST_COMPONENTS)[number];
  test: (lowercasedName: string) => boolean;
}> = [
  { label: 'Admission Fee', test: (n) => n.includes('admission') },
  { label: 'School Uniform', test: (n) => n.includes('uniform') },
  { label: 'Termly Tuition', test: (n) => n.includes('tuition') },
];

/**
 * Map a stored fee name to its fixed canonical label when it is one of the
 * three core rows (any casing/wording); otherwise return the trimmed name.
 */
export function canonicalizeFeeName(name: string): string {
  const n = name.trim().toLowerCase();
  return CANONICAL_MATCHERS.find((m) => m.test(n))?.label ?? name.trim();
}

/** True when the name is one of the three fixed core rows (any casing). */
export function isCoreFeeName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return CANONICAL_MATCHERS.some((m) => m.test(n));
}

/** Canonical display order (Admission, Uniform, Tuition) for a label. */
export function canonicalOrder(label: string): number {
  const index = (CANONICAL_FIRST_COMPONENTS as readonly string[]).indexOf(label);
  return index === -1 ? CANONICAL_FIRST_COMPONENTS.length : index;
}
