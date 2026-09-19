/**
 * Canonical contact keys used only for guardian matching. The original
 * display values remain untouched for receipts and staff-facing records.
 */
export function normalizeGuardianPhone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('233') && digits.length >= 9) return digits;
  if (digits.startsWith('0') && digits.length >= 9) return `233${digits.slice(1)}`;
  return digits;
}

export function normalizeGuardianEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() || '';
  return email || null;
}
