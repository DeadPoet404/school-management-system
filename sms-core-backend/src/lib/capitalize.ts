/**
 * Case normalization for the "no small letters" rule (Admin 2026-09).
 *
 * All student and staff/teacher text entered in the app is stored in
 * CAPITAL LETTERS. Emails are deliberately excluded from every call site:
 * they are matched case-sensitively for logins and the fees portal.
 *
 * Normalization happens at the service write chokepoints (create + update),
 * which also cover the CSV/XLSX bulk-import paths — all of which funnel
 * through the same create functions.
 */

/** Uppercase a string value; null/undefined pass through untouched. */
export function toCaps(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  return value.toUpperCase();
}

/**
 * Uppercase the given string fields of an object, in place.
 *
 * Non-string values (numbers, dates, booleans) and null/undefined are
 * left untouched, and missing keys are ignored — safe to call on
 * partially-filled payloads.
 */
export function capStringFields<T extends object>(
  obj: T,
  keys: readonly (keyof T & string)[],
): void {
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') record[key] = value.toUpperCase();
  }
}
