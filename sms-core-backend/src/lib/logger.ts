import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Paths redacted from all log output (Pino fast-redact).
 * Covers httpOnly auth cookies, bearer tokens, passwords, and high-risk PII
 * that must never appear in application or request logs.
 *
 * Keep this list shared so unit tests assert the same paths production uses.
 */
export const LOG_REDACT_PATHS: string[] = [
  // HTTP headers / cookies (pino-http req/res shape)
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers.Authorization',
  'req.headers["set-cookie"]',
  'req.headers["Set-Cookie"]',
  'res.headers["set-cookie"]',
  'res.headers["Set-Cookie"]',
  'headers.cookie',
  'headers.authorization',
  'headers.Authorization',
  'headers["set-cookie"]',

  // Auth secrets — top-level and one level nested
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'jwt',
  'secret',
  'cookie',
  'authorization',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.idToken',
  '*.jwt',
  '*.secret',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.token',
  'req.body.accessToken',
  'req.body.refreshToken',

  // High-risk PII / payroll / medical
  'nationalId',
  'nationalID',
  'ssnit',
  'SSNIT',
  'bankAccount',
  'bankAccountNumber',
  'accountNumber',
  'medicalNotes',
  'medicalNote',
  '*.nationalId',
  '*.nationalID',
  '*.ssnit',
  '*.SSNIT',
  '*.bankAccount',
  '*.bankAccountNumber',
  '*.accountNumber',
  '*.medicalNotes',
  '*.medicalNote',
];

export const LOG_REDACT_CENSOR = '[Redacted]';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: LOG_REDACT_PATHS,
    censor: LOG_REDACT_CENSOR,
  },
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    },
  }),
});
