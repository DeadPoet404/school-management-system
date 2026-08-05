/**
 * SMS-007 -- converts a monetary amount to its English words representation,
 * denominated in Ghana Cedis / Pesewas (e.g. "One Thousand Two Hundred
 * Thirty-Four Cedis, Fifty-Six Pesewas Only"). Used on official receipts.
 */

const SMALL: readonly string[] = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS: readonly string[] = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

const SCALES: ReadonlyArray<[number, string]> = [
  [1_000_000_000, 'Billion'],
  [1_000_000, 'Million'],
  [1_000, 'Thousand'],
];

function threeDigits(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(`${SMALL[hundreds]!} Hundred`);
  if (rest >= 20) {
    const tens = Math.floor(rest / 10);
    const unit = rest % 10;
    parts.push(unit > 0 ? `${TENS[tens]!}-${SMALL[unit]!}` : TENS[tens]!);
  } else if (rest > 0) {
    parts.push(SMALL[rest]!);
  }
  return parts.join(' ');
}

export function integerToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error(`integerToWords: expected a non-negative integer, got ${n}`);
  if (n === 0) return 'Zero';
  let rest = n;
  const segments: string[] = [];
  for (const [value, name] of SCALES) {
    const quotient = Math.floor(rest / value);
    if (quotient > 0) {
      segments.push(`${integerToWords(quotient)} ${name}`);
      rest %= value;
    }
  }
  if (rest > 0) segments.push(threeDigits(rest));
  return segments.join(' ');
}

export function amountInWords(amount: string | number): string {
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`amountInWords: invalid amount ${amount}`);
  }
  const totalPesewas = Math.round(numeric * 100);
  const cedis = Math.floor(totalPesewas / 100);
  const pesewas = totalPesewas % 100;
  const main = `${integerToWords(cedis)} Cedis`;
  const sub = pesewas > 0 ? `, ${integerToWords(pesewas)} Pesewas` : '';
  return `${main}${sub} Only`;
}
