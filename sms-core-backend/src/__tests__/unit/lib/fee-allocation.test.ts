import { describe, expect, it } from 'vitest';
import {
  ENROLLMENT_UMBRELLA,
  canonicalOrder,
  canonicalizeFeeName,
  isCoreFeeName,
} from '@/lib/fee-allocation';

describe('fee allocation vocabulary', () => {
  it('maps core rows to canonical labels by meaning, not position', () => {
    expect(canonicalizeFeeName('Termly Tuition')).toBe('Termly Tuition');
    expect(canonicalizeFeeName('ADMISSION')).toBe('Admission Fee');
    expect(canonicalizeFeeName('Uniform (P.E.)')).toBe('School Uniform');
    expect(canonicalizeFeeName('  admission fee  ')).toBe('Admission Fee');
  });

  it('leaves non-core (extra expense) names untouched', () => {
    expect(canonicalizeFeeName('Midday Catering & Snacks')).toBe('Midday Catering & Snacks');
    expect(canonicalizeFeeName('Computer Lab Levy')).toBe('Computer Lab Levy');
    expect(canonicalizeFeeName('')).toBe('');
  });

  it('flags only the three core rows', () => {
    expect(isCoreFeeName('Termly Tuition')).toBe(true);
    expect(isCoreFeeName('Admission')).toBe(true);
    expect(isCoreFeeName('School Uniform')).toBe(true);
    expect(isCoreFeeName('Stationery Kit')).toBe(false);
  });

  it('orders the canonical labels Admission, Uniform, Tuition', () => {
    expect(canonicalOrder('Admission Fee')).toBeLessThan(canonicalOrder('School Uniform'));
    expect(canonicalOrder('School Uniform')).toBeLessThan(canonicalOrder('Termly Tuition'));
  });

  it('exposes the enrollment umbrella label', () => {
    expect(ENROLLMENT_UMBRELLA).toContain('Admission');
    expect(ENROLLMENT_UMBRELLA).toContain('Uniform');
    expect(ENROLLMENT_UMBRELLA).toContain('Tuition');
  });
});
