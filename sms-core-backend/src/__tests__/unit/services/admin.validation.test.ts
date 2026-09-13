import { describe, it, expect } from 'vitest';
import { institutionUpdateSchema, dataWipeSchema } from '@/modules/admin/admin.validation';

describe('institutionUpdateSchema', () => {
  it('accepts a 3-letter uppercase currency code', () => {
    const parsed = institutionUpdateSchema.safeParse({ currency: 'GHS' });
    expect(parsed.success).toBe(true);
  });

  it('rejects non-3-letter or lowercase currency codes', () => {
    expect(institutionUpdateSchema.safeParse({ currency: 'usd' }).success).toBe(false);
    expect(institutionUpdateSchema.safeParse({ currency: 'GH' }).success).toBe(false);
    expect(institutionUpdateSchema.safeParse({ currency: 'GHCE' }).success).toBe(false);
  });

  it('uppercases the country code', () => {
    const parsed = institutionUpdateSchema.safeParse({ country: 'gh' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.country).toBe('GH');
  });

  it('rejects an empty update', () => {
    expect(institutionUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(institutionUpdateSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});

describe('dataWipeSchema', () => {
  it('accepts the four valid scopes', () => {
    for (const scope of ['students', 'personnel', 'financial', 'all'] as const) {
      expect(dataWipeSchema.safeParse({ scope, confirm: 'JCS-2025' }).success).toBe(true);
    }
  });

  it('rejects unknown scopes', () => {
    expect(dataWipeSchema.safeParse({ scope: 'invoices', confirm: 'X' }).success).toBe(false);
  });

  it('requires a non-empty confirm string', () => {
    expect(dataWipeSchema.safeParse({ scope: 'all', confirm: '' }).success).toBe(false);
    expect(dataWipeSchema.safeParse({ scope: 'all' }).success).toBe(false);
  });
});
