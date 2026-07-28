import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { Writable } from 'stream';
import { LOG_REDACT_CENSOR, LOG_REDACT_PATHS } from '@/lib/logger';

/**
 * Build a throwaway pino instance that uses the same redact paths as production
 * and writes JSON lines into an in-memory buffer (no pino-pretty transport).
 */
function captureLog(payload: object): string {
  let output = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });

  const log = pino(
    {
      level: 'info',
      redact: {
        paths: [...LOG_REDACT_PATHS],
        censor: LOG_REDACT_CENSOR,
      },
    },
    stream
  );

  log.info(payload);
  return output;
}

describe('Pino log redaction', () => {
  it('exports a non-empty shared redact path list', () => {
    expect(LOG_REDACT_PATHS.length).toBeGreaterThan(10);
    expect(LOG_REDACT_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.cookie',
        'req.headers.authorization',
        'password',
        '*.refreshToken',
        '*.nationalId',
        '*.ssnit',
        '*.bankAccountNumber',
        '*.medicalNotes',
      ])
    );
  });

  it('redacts Cookie and Authorization request headers', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';
    const out = captureLog({
      req: {
        method: 'GET',
        url: '/api/students',
        headers: {
          cookie: `accessToken=${jwt}; refreshToken=refresh-secret-value`,
          authorization: `Bearer ${jwt}`,
        },
      },
    });

    expect(out).not.toContain(jwt);
    expect(out).not.toContain('refresh-secret-value');
    expect(out).not.toContain('accessToken=');
    expect(out).not.toContain('Bearer ');
    expect(out).toContain(LOG_REDACT_CENSOR);
  });

  it('redacts passwords and tokens on request bodies and nested objects', () => {
    const out = captureLog({
      req: {
        body: {
          email: 'admin@school.test',
          password: 'SuperSecretPassword!234',
          refreshToken: 'raw-refresh-token-value',
        },
      },
      user: {
        accessToken: 'raw-access-token-value',
      },
    });

    expect(out).toContain('admin@school.test');
    expect(out).not.toContain('SuperSecretPassword!234');
    expect(out).not.toContain('raw-refresh-token-value');
    expect(out).not.toContain('raw-access-token-value');
    expect(out).toContain(LOG_REDACT_CENSOR);
  });

  it('redacts national ID, SSNIT, bank, and medical PII fields', () => {
    const out = captureLog({
      student: {
        fullName: 'Ama Mensah',
        nationalId: 'GHA-123456789-0',
        ssnit: 'C123456789012',
        bankAccountNumber: '1234567890123',
        medicalNotes: 'Asthma — keep inhaler on file',
      },
    });

    expect(out).toContain('Ama Mensah');
    expect(out).not.toContain('GHA-123456789-0');
    expect(out).not.toContain('C123456789012');
    expect(out).not.toContain('1234567890123');
    expect(out).not.toContain('Asthma');
    expect(out).toContain(LOG_REDACT_CENSOR);
  });

  it('redacts top-level password and token fields from ad-hoc logs', () => {
    const out = captureLog({
      msg: 'login attempt',
      password: 'plaintext-password',
      token: 'session-token-value',
      refreshToken: 'refresh-token-value',
    });

    expect(out).toContain('login attempt');
    expect(out).not.toContain('plaintext-password');
    expect(out).not.toContain('session-token-value');
    expect(out).not.toContain('refresh-token-value');
    expect(out).toContain(LOG_REDACT_CENSOR);
  });
});
