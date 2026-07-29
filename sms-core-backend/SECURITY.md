# Security - V1 Accepted-Risk Register (sms-core-backend)

Production (`npm audit --omit=dev`) advisories that remain after applying every
semver-safe, non-breaking fix, with the maintainer-approved V1 accepted-risk decision
for each (release-readiness item SMS-006). Where a clean upgrade existed it was applied
(frontend: next 16.2.9 -> 16.2.12 plus `npm audit fix`; backend: `npm audit fix`); the
entries below are those with no such upgrade.

## Per-advisory decisions

### npm-1108110 - `xlsx` (high)
- Title: Prototype Pollution in sheetJS
- URL: https://github.com/advisories/GHSA-4r6h-8v6p-xvw6
- Direct dependency: True
- Decision: ACCEPTED RISK for V1.
  Spreadsheet parsing is reachable ONLY through the student/teacher/staff import
  endpoints, each RBAC-guarded to requireRole(STAFF, ADMIN); uploads are size-capped by
  multer (5 MB); parsed rows are validated by Zod before persistence; only named scalar
  fields are read and are never deep-merged into prototypes or rendered to HTML (no xlsx
  HTML export is used). The high advisories are Prototype Pollution (GHSA-4r6h-8v6p-xvw6)
  and ReDoS (GHSA-5pgg-2g8v-p4x9): the pollution sink is not exercised by our usage and
  the ReDoS is bounded by the upload cap and the privileged-only endpoint. The npm `xlsx`
  package has no patched release on the npm registry, so it cannot be version-bumped.
- Planned remediation: post-V1, refresh or override the affected transitive
  dependency (or replace it) and re-run `npm audit --omit=dev`.

### npm-1108111 - `xlsx` (high)
- Title: SheetJS Regular Expression Denial of Service (ReDoS)
- URL: https://github.com/advisories/GHSA-5pgg-2g8v-p4x9
- Direct dependency: True
- Decision: ACCEPTED RISK for V1.
  Spreadsheet parsing is reachable ONLY through the student/teacher/staff import
  endpoints, each RBAC-guarded to requireRole(STAFF, ADMIN); uploads are size-capped by
  multer (5 MB); parsed rows are validated by Zod before persistence; only named scalar
  fields are read and are never deep-merged into prototypes or rendered to HTML (no xlsx
  HTML export is used). The high advisories are Prototype Pollution (GHSA-4r6h-8v6p-xvw6)
  and ReDoS (GHSA-5pgg-2g8v-p4x9): the pollution sink is not exercised by our usage and
  the ReDoS is bounded by the upload cap and the privileged-only endpoint. The npm `xlsx`
  package has no patched release on the npm registry, so it cannot be version-bumped.
- Planned remediation: post-V1, refresh or override the affected transitive
  dependency (or replace it) and re-run `npm audit --omit=dev`.

