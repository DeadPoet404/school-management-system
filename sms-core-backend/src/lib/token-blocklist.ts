/**
 * In-memory access token blocklist.
 *
 * Provides immediate token revocation on logout and supports
 * bulk invalidation by user (e.g., after password change).
 *
 * NOTE: In-memory only — resets on server restart. Acceptable for
 * a single-instance school management system. For multi-instance
 * deployments, replace with Redis-backed storage.
 */

const blockedTokens = new Map<string, number>();
const userInvalidations = new Map<string, number>();

/** Block a specific access token by its raw string value. */
export function blockToken(token: string): void {
  blockedTokens.set(token, Date.now());
}

/** Check if a specific raw token has been blocked. */
export function isTokenBlocked(token: string): boolean {
  return blockedTokens.has(token);
}

/**
 * Invalidate ALL access tokens for a user that were issued
 * at or before the given iat (issued-at timestamp).
 * Useful after password changes — invalidates all prior sessions.
 */
export function invalidateUserTokensBefore(sub: string, iat: number): void {
  const existing = userInvalidations.get(sub);
  if (!existing || iat < existing) {
    userInvalidations.set(sub, iat);
  }
}

/** Check if a token was issued before an invalidation threshold. */
export function isUserInvalidated(sub: string, iat: number | undefined): boolean {
  if (iat === undefined) return false;
  const threshold = userInvalidations.get(sub);
  if (threshold === undefined) return false;
  return iat <= threshold;
}

/**
 * Start a periodic cleanup job that removes expired entries
 * from the blocked tokens map. Runs every 15 minutes by default.
 * User invalidations are permanent (until restart) — no cleanup.
 */
export function startBlocklistCleanup(intervalMs = 15 * 60 * 1000): ReturnType<typeof setInterval> {
  return setInterval(() => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000;
    for (const [token, blockedAt] of blockedTokens) {
      if (now - blockedAt > maxAge) {
        blockedTokens.delete(token);
      }
    }
  }, intervalMs);
}
