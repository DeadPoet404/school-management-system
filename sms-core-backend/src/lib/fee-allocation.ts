/**
 * Shared fee-allocation vocabulary.
 *
 * The first three rows of every class fee structure carry fixed, canonical
 * names (Admin directive 2026-09): Admission Fee, School Uniform, Termly
 * Tuition. Anything from row four onwards is a school-defined extra expense
 * and keeps its free-form name.
 *
 * The enrollment umbrella is the allocation label for first-term payments
 * made by NEW enrollees (including the initial deposit recorded at
 * enrollment). When a receipt is generated for a collection whose allocation
 * target IS the umbrella, the A5 receipt renders the full first-term fee
 * breakdown (the three canonical rows + total) instead of a single line.
 */
export const CANONICAL_FIRST_COMPONENTS = [
  'Admission Fee',
  'School Uniform',
  'Termly Tuition',
] as const;

export const ENROLLMENT_UMBRELLA =
  'First Term Enrollment (Admission + Uniform + Tuition)';

/** Display name for a fee component at a given 0-based row position. */
export function canonicalComponentName(row: number, storedName: string): string {
  return CANONICAL_FIRST_COMPONENTS[row] ?? storedName;
}
