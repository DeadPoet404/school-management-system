// Core fee rows carry FIXED canonical names (Admin directive 2026-09).
// Matching is BY MEANING, never by row position — the stored row order
// varies per class, and amounts must stay attached to the right name.
// Mirrors the backend's src/lib/fee-allocation.ts.

export const CORE_FEE_NAMES = ["Admission Fee", "School Uniform", "Termly Tuition"] as const

/**
 * Returns the fixed canonical label when the stored name is one of the
 * three core rows (any casing/wording), otherwise null.
 */
export function canonicalizeFeeName(name: string): string | null {
  const n = name.trim().toLowerCase()
  if (n.includes("admission")) return "Admission Fee"
  if (n.includes("uniform")) return "School Uniform"
  if (n.includes("tuition")) return "Termly Tuition"
  return null
}
