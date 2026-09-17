import { describe, it, expect } from 'vitest';
import { toCaps, capStringFields } from '@/lib/capitalize';

describe('toCaps', () => {
  it('uppercases a mixed-case string', () => {
    expect(toCaps('Akyeabea Kezia Asante')).toBe('AKYEABEA KEZIA ASANTE');
  });

  it('leaves an already-uppercase string unchanged', () => {
    expect(toCaps('JCS-34-041')).toBe('JCS-34-041');
  });

  it('passes null and undefined through untouched', () => {
    expect(toCaps(null)).toBeNull();
    expect(toCaps(undefined)).toBeUndefined();
  });

  it('keeps an empty string empty', () => {
    expect(toCaps('')).toBe('');
  });

  it('handles non-ASCII names', () => {
    expect(toCaps('Renée O\'Fori')).toBe("RENÉE O'FORI");
  });
});

describe('capStringFields', () => {
  it('uppercases only the given string fields, in place', () => {
    const obj = {
      name: 'kofi ame',
      email: 'kofi@jocomfy.com', // not in keys — must stay untouched
      age: 12,
      notes: null,
      missing: undefined,
    };
    capStringFields(obj, ['name', 'notes']);
    expect(obj.name).toBe('KOFI AME');
    expect(obj.email).toBe('kofi@jocomfy.com');
    expect(obj.age).toBe(12);
    expect(obj.notes).toBeNull();
    expect(obj.missing).toBeUndefined();
  });

  it('ignores missing keys without throwing', () => {
    const obj = { name: 'abena' } as { name: string; other?: string | null };
    capStringFields(obj, ['name', 'other']);
    expect(obj.name).toBe('ABENA');
    expect(obj.other).toBeUndefined();
  });

  it('does not touch non-string values even when named', () => {
    const obj = { code: 1234 as unknown as string };
    capStringFields(obj, ['code']);
    expect(obj.code).toBe(1234);
  });
});
