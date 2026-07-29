# Security - V1 Accepted-Risk Register (sms-core)

Production (`npm audit --omit=dev`) advisories that remain after applying every
semver-safe, non-breaking fix, with the maintainer-approved V1 accepted-risk decision
for each (release-readiness item SMS-006). Where a clean upgrade existed it was applied
(frontend: next 16.2.9 -> 16.2.12 plus `npm audit fix`; backend: `npm audit fix`); the
entries below are those with no such upgrade.

## Per-advisory decisions

### npm-1124252 - `postcss` (high)
- Title: PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments
- URL: https://github.com/advisories/GHSA-6g55-p6wh-862q
- Direct dependency: False
- Decision: ACCEPTED RISK for V1.
  Build-time CSS tooling used by Next.js to compile stylesheets. The advisories
  (XSS in CSS stringify; arbitrary file read and path traversal via an
  attacker-controlled sourceMappingURL) require compiling CSS that embeds a
  malicious source-map reference. Production serves compiled static CSS authored in
  our own source; we never feed attacker-authored CSS or source maps into the build,
  so the attack surface is not reachable from end-user requests and is not on the
  authenticated request-handling path. A clean fix currently requires a breaking
  Next downgrade, so it is accepted for V1.
- Planned remediation: post-V1, refresh or override the affected transitive
  dependency (or replace it) and re-run `npm audit --omit=dev`.

### npm-1124288 - `postcss` (high)
- Title: PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure
- URL: https://github.com/advisories/GHSA-r28c-9q8g-f849
- Direct dependency: False
- Decision: ACCEPTED RISK for V1.
  Build-time CSS tooling used by Next.js to compile stylesheets. The advisories
  (XSS in CSS stringify; arbitrary file read and path traversal via an
  attacker-controlled sourceMappingURL) require compiling CSS that embeds a
  malicious source-map reference. Production serves compiled static CSS authored in
  our own source; we never feed attacker-authored CSS or source maps into the build,
  so the attack surface is not reachable from end-user requests and is not on the
  authenticated request-handling path. A clean fix currently requires a breaking
  Next downgrade, so it is accepted for V1.
- Planned remediation: post-V1, refresh or override the affected transitive
  dependency (or replace it) and re-run `npm audit --omit=dev`.

### npm-1124066 - `sharp` (high)
- Title: sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591
- URL: https://github.com/advisories/GHSA-f88m-g3jw-g9cj
- Direct dependency: False
- Decision: ACCEPTED RISK for V1.
  Used by Next.js Image Optimization; the libvips CVEs are exercised only when
  decoding image bytes. By default Next optimizes same-origin images only (remote
  sources require an explicit images.remotePatterns allowlist), enforces size limits,
  and runs optimization in an isolated worker. Residual risk is a malformed image
  slowing or failing a single optimization request, with no privilege or data
  exposure. Bounded and scheduled for the post-V1 dependency refresh.
- Planned remediation: post-V1, refresh or override the affected transitive
  dependency (or replace it) and re-run `npm audit --omit=dev`.

### npm-1117015 - `postcss` (moderate)
- Title: PostCSS has XSS via Unescaped </style> in its CSS Stringify Output
- URL: https://github.com/advisories/GHSA-qx2v-qp2m-jg93
- Direct dependency: False
- Decision: ACCEPTED RISK for V1.
  Build-time CSS tooling used by Next.js to compile stylesheets. The advisories
  (XSS in CSS stringify; arbitrary file read and path traversal via an
  attacker-controlled sourceMappingURL) require compiling CSS that embeds a
  malicious source-map reference. Production serves compiled static CSS authored in
  our own source; we never feed attacker-authored CSS or source maps into the build,
  so the attack surface is not reachable from end-user requests and is not on the
  authenticated request-handling path. A clean fix currently requires a breaking
  Next downgrade, so it is accepted for V1.
- Planned remediation: post-V1, refresh or override the affected transitive
  dependency (or replace it) and re-run `npm audit --omit=dev`.

