/**
 * Display label for a class in dropdowns.
 *
 * 2026-09 admin cleanup: class names already carry the section letter
 * (e.g. "KG1A"), so the old "KG1A — A" / "KG1A (A)" labels showed the
 * letter twice. Show the bare name; keep the suffix ONLY when the name
 * genuinely does not end with the section letter (e.g. a class named
 * "KG1" with section "A" → "KG1 (A)"), so no two classes can look alike.
 */
export function classDisplayName(name: string, section?: string | null): string {
  const n = (name ?? '').trim();
  const s = (section ?? '').trim().toUpperCase();
  if (!s) return n;
  if (n.toUpperCase().endsWith(s)) return n;
  return `${n} (${s})`;
}
