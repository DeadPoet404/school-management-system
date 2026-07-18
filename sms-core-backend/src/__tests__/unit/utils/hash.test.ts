import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '@/utils/hash';

describe('hashPassword', () => {
  it('should return a hash different from the plain text', async () => {
    const plain = 'mySecret123';
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should produce different hashes for the same input (salt randomness)', async () => {
    const plain = 'samePassword';
    const [hash1, hash2] = await Promise.all([hashPassword(plain), hashPassword(plain)]);
    expect(hash1).not.toBe(hash2);
  });
});

describe('comparePassword', () => {
  it('should return true for correct password', async () => {
    const plain = 'correctPassword';
    const hash = await hashPassword(plain);
    expect(await comparePassword(plain, hash)).toBe(true);
  });

  it('should return false for incorrect password', async () => {
    const hash = await hashPassword('originalPassword');
    expect(await comparePassword('wrongPassword', hash)).toBe(false);
  });

  it('should return false for empty string against a hash', async () => {
    const hash = await hashPassword('something');
    expect(await comparePassword('', hash)).toBe(false);
  });
});
