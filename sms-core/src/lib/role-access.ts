// SMS-005: V1 role -> route access matrix.
//
// Single source of truth the frontend uses to (a) route each role to a valid
// landing page after login, (b) hide sidebar / operations links the backend
// would reject with 403, and (c) render an access-denied panel on direct
// navigation to a forbidden path. The backend RBAC (requireRole per route)
// stays the authoritative security boundary; this only mirrors it for UX.
// Cells are derived from the backend GET permissions, so a shown link never 403s.

export type Role = "ADMIN" | "ACCOUNTANT" | "STAFF" | "FACULTY" | "STUDENT"

export const ALL_ROLES: Role[] = ["ADMIN", "ACCOUNTANT", "STAFF", "FACULTY", "STUDENT"]

export type TopLevelModule =
  | "/dashboard"
  | "/students"
  | "/teachers"
  | "/staff"
  | "/finance"
  | "/operations"

const TOP_LEVEL_BY_ROLE: Record<Role, TopLevelModule[]> = {
  ADMIN: ["/dashboard", "/students", "/teachers", "/staff", "/finance", "/operations"],
  ACCOUNTANT: ["/dashboard", "/students", "/staff", "/finance", "/operations"],
  STAFF: ["/dashboard", "/students", "/teachers", "/operations"],
  FACULTY: ["/students", "/teachers", "/operations"],
  STUDENT: [],
}

const OPERATIONS_BY_ROLE: Record<Role, string[]> = {
  ADMIN: ["class-gen", "fee-structure", "payment-collection", "payroll-ledgers", "staff-registry", "enrollment-workflow", "ca-gradebook"],
  ACCOUNTANT: ["fee-structure", "payment-collection", "payroll-ledgers", "staff-registry"],
  STAFF: ["enrollment-workflow", "ca-gradebook"],
  FACULTY: ["class-gen", "ca-gradebook"],
  STUDENT: [],
}

const SUBPATH_OVERRIDES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/students/gradebook", roles: ["FACULTY", "ADMIN", "STAFF"] },
]

const LANDING_PRIORITY: TopLevelModule[] = ["/dashboard", "/students", "/teachers", "/staff", "/finance", "/operations"]

const FALLBACK_LANDING: TopLevelModule = "/dashboard"

function normalizeRole(role: string | null | undefined): Role | null {
  if (!role) return null
  return (ALL_ROLES as string[]).includes(role) ? (role as Role) : null
}

function allowedTopLevel(role: Role): TopLevelModule[] {
  return TOP_LEVEL_BY_ROLE[role]
}

export function roleHasAnyModule(role: string | null | undefined): boolean {
  const r = normalizeRole(role)
  return r !== null && allowedTopLevel(r).length > 0
}

export function isPathAllowedForRole(role: string | null | undefined, pathname: string | null | undefined): boolean {
  const r = normalizeRole(role)
  if (!r || !pathname) return false
  const override = SUBPATH_OVERRIDES.find((o) => pathname === o.prefix || pathname.startsWith(o.prefix + "/"))
  if (override) return override.roles.includes(r)
  return allowedTopLevel(r).some((mod) => pathname === mod || pathname.startsWith(mod + "/"))
}

export function landingPathForRole(role: string | null | undefined, requested?: string | null): string {
  const r = normalizeRole(role)
  if (!r) return FALLBACK_LANDING
  const safeRequested =
    typeof requested === "string" &&
    requested.startsWith("/") &&
    !requested.startsWith("//") &&
    requested !== "/login" &&
    isPathAllowedForRole(r, requested)
      ? requested
      : null
  if (safeRequested) return safeRequested
  if (!roleHasAnyModule(r)) return FALLBACK_LANDING
  return LANDING_PRIORITY.find((mod) => allowedTopLevel(r).includes(mod)) ?? FALLBACK_LANDING
}

export function defaultLandingForRole(role: string | null | undefined): string {
  return landingPathForRole(role, null)
}

export function isOperationAllowedForRole(role: string | null | undefined, moduleId: string): boolean {
  const r = normalizeRole(role)
  if (!r) return false
  return OPERATIONS_BY_ROLE[r].includes(moduleId)
}
