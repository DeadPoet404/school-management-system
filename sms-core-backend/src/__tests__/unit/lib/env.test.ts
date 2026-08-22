import { describe, it, expect } from 'vitest';
import { validateEnvValues } from '@/lib/env';

// Valid baseline — every test mutates one field at a time.
const baseEnv: Record<string, string> = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  COOKIE_SECRET: 'c'.repeat(64),
  NODE_ENV: 'test',
};

const issueMessages = (res: ReturnType<typeof validateEnvValues>) =>
  res.success ? [] : res.error.issues.map((i) => i.message);

describe('env validation — secret hardening (P0)', () => {
  it('accepts a valid env with distinct secrets', () => {
    const res = validateEnvValues(baseEnv);
    expect(res.success).toBe(true);
  });

  it('rejects JWT_REFRESH_SECRET equal to JWT_SECRET (dual-token collapse)', () => {
    const res = validateEnvValues({
      ...baseEnv,
      JWT_REFRESH_SECRET: baseEnv.JWT_SECRET,
    });
    expect(res.success).toBe(false);
    expect(issueMessages(res).some((m) => /must differ from JWT_SECRET/i.test(m))).toBe(true);
  });

  it('rejects .env.example placeholder secrets in production', () => {
    const res = validateEnvValues({
      ...baseEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'change_me_generate_with_openssl_rand_hex_32',
    });
    expect(res.success).toBe(false);
    expect(issueMessages(res).some((m) => /placeholder/i.test(m))).toBe(true);
  });

  it('rejects placeholder COOKIE_SECRET in production', () => {
    const res = validateEnvValues({
      ...baseEnv,
      NODE_ENV: 'production',
      COOKIE_SECRET: 'change_me_another_secret_openssl_rand_hex_32',
    });
    expect(res.success).toBe(false);
    expect(issueMessages(res).some((m) => /COOKIE_SECRET.*placeholder/i.test(m))).toBe(true);
  });

  it('rejects JWT secrets shorter than 32 chars in production', () => {
    const res = validateEnvValues({
      ...baseEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'short-but-16-chars-ok',
      JWT_REFRESH_SECRET: 'also-exactly-16-chars',
    });
    expect(res.success).toBe(false);
    // Both secrets trip the 32-char production floor.
    expect(issueMessages(res).filter((m) => /at least 32 characters in production/.test(m))).toHaveLength(2);
  });

  it('still allows 16-char secrets outside production (dev/test backwards compat)', () => {
    const res = validateEnvValues({
      ...baseEnv,
      JWT_SECRET: 'a'.repeat(16),
      JWT_REFRESH_SECRET: 'b'.repeat(16),
    });
    expect(res.success).toBe(true);
  });

  it('accepts strong 64-char hex secrets in production', () => {
    const res = validateEnvValues({ ...baseEnv, NODE_ENV: 'production' });
    expect(res.success).toBe(true);
  });
});
