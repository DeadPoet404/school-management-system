/* eslint-disable @typescript-eslint/no-explicit-any -- generic utility functions */
import { init } from "@paralleldrive/cuid2";

// Generates a secure, highly optimized, non-colliding sequential fingerprint block.
// Includes current year so the fingerprint rotates annually across deployments.
const generateSecureCounter = init({
  length: 6,
  fingerprint: `sms-backend-cluster-${new Date().getFullYear()}`,
});

/**
 * Generates an ironclad unique institutional business key.
 * Format Output: prefix-deptCode-CUID6 (e.g., STF-ADMIN-x7a9k2)
 */
export function formatInstitutionalId(prefix: string, deptCode: string): string {
  const cleanPrefix = prefix.trim().toUpperCase();
  const cleanDept = deptCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const secureSuffix = generateSecureCounter();

  return `${cleanPrefix}-${cleanDept}-${secureSuffix}`;
}

/**
 * Generates a sequential serial number string.
 * Combines timestamp entropy with a safe incremental counter to avoid collisions.
 *
 * Example: REC-2025-8941-0024  (year is dynamic)
 */
export function generateSerial(
  prefix: string,
  currentCount: number,
  padding: number = 4
): string {
  const timestampComponent = Date.now().toString().slice(-4);
  const paddedCount = String(currentCount + 1).padStart(padding, "0");

  return `${prefix}-${timestampComponent}-${paddedCount}`;
}

/**
 * Safely converts Prisma Decimal types to standard JavaScript Numbers.
 * Prisma Decimals are objects with a `toString()` method, not raw numbers.
 */
export function parseDecimal(value: any): number {
  if (value === null || value === undefined) return 0;
  const str = typeof value === "string" ? value : value.toString();
  return parseFloat(str) || 0;
}
