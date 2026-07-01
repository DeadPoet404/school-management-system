/**
 * Safely converts Prisma Decimal types to standard JavaScript Numbers.
 * Prisma Decimals are objects with a `toString()` method, not raw numbers.
 */
export function parseDecimal(value: any): number {
  if (value === null || value === undefined) return 0;
  const str = typeof value === 'string' ? value : value.toString();
  return parseFloat(str) || 0;
}

/**
 * Generates a sequential serial number string.
 * @param prefix - e.g., 'REC-2026'
 * @param count - The current count from the database
 * @param padLength - How many digits to pad (default 4 -> 1001)
 * @param startAt - Where the sequence begins (default 1001)
 * 
 * @example generateSerial('REC-2026', 5) -> 'REC-2026-1006'
 * @example generateSerial('INV-JHS1', 2, 4, 1) -> 'INV-JHS1-0003'
 */
export function generateSerial(
  prefix: string, 
  count: number, 
  padLength: number = 4, 
  startAt: number = 1001
): string {
  return `${prefix}-${String(startAt + count).padStart(padLength, '0')}`;
}

/**
 * Generates a random 6-digit numeric suffix.
 * @example generateRandomSuffix() -> 482910
 */
export function generateRandomSuffix(): number {
  return Math.floor(100000 + Math.random() * 900000);
}

/**
 * Formats a standard institutional ID.
 * @example formatInstitutionalId('STF', 'FIN') -> 'STF-FIN-482910'
 */
export function formatInstitutionalId(prefix: string, deptCode: string): string {
  return `${prefix}-${deptCode}-${generateRandomSuffix()}`;
}