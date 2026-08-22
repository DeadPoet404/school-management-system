/* eslint-disable no-console */
import { z } from 'zod';

const envSchema = z
  .object({
    // ── REQUIRED — server will not start without these ──
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required and cannot be empty.'),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters for security.'),
    // P1-9: JWT_REFRESH_SECRET is now REQUIRED. Previously optional with a
    // fallback to JWT_SECRET, which meant refresh and access tokens shared
    // the same signing key — defeating the purpose of dual-token architecture.
    // If an access token was compromised, an attacker could forge refresh tokens.
    // Generate a separate secret and add it to your .env file.
    JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters and MUST differ from JWT_SECRET.'),
    COOKIE_SECRET: z.string().min(16).optional(),

    // ── OPTIONAL — have safe defaults ──
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    ENABLE_API_DOCS: z.coerce.string().transform(v => v === 'true').default(false),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SECURE: z.coerce.string().transform(v => v === 'true').default(false),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
    GOOGLE_CLIENT_ID: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    GMAIL_USER: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    GMAIL_APP_PASSWORD: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    CALENDAR_FEED_SECRET: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(32, 'CALENDAR_FEED_SECRET should be at least 32 random characters.').optional(),
    ),
    ARKESEL_API_KEY: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    ARKESEL_SENDER_ID: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().max(11, 'ARKESEL_SENDER_ID must be 11 characters or fewer.').optional(),
    ),
    META_WA_PHONE_NUMBER_ID: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    META_WA_ACCESS_TOKEN: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    META_WA_BUSINESS_ACCOUNT_ID: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(100),
    AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(5),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((env, ctx) => {
    // ── P0: the error message always claimed these must differ — now enforced.
    // Equal secrets collapse the dual-token architecture: anyone who can verify
    // access tokens can also mint refresh tokens (and vice versa).
    if (env.JWT_REFRESH_SECRET === env.JWT_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_SECRET. Generate two separate secrets: openssl rand -hex 32',
      });
    }

    if (env.NODE_ENV === 'production') {
      const record = env as unknown as Record<string, string | undefined>;
      // ── P0: refuse to boot on the .env.example placeholders.
      for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'COOKIE_SECRET']) {
        const value = record[key];
        if (value && /^change_me/i.test(value)) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is still the .env.example placeholder. Generate a real secret: openssl rand -hex 32`,
          });
        }
      }
      // ── P0: 16 chars is the floor for dev/test; production gets 32+.
      for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
        const value = record[key];
        if (value && value.length < 32) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} must be at least 32 characters in production. Generate with: openssl rand -hex 32`,
          });
        }
      }
    }
  });

/**
 * Pure validation function — takes a raw env record, returns the Zod result.
 * Exported for unit tests so the boot-path itself stays unmocked.
 */
export function validateEnvValues(raw: Record<string, string | undefined>) {
  return envSchema.safeParse(raw);
}

/**
 * Validates all environment variables at startup.
 * Must be imported AFTER dotenv/config so .env values are loaded.
 * Throws immediately if required variables are missing or invalid.
 */
function validateEnv() {
  const result = validateEnvValues(process.env);

  if (!result.success) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ENVIRONMENT VALIDATION FAILED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const issue of result.error.issues) {
      console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(1);
  }

  // Merge parsed+defaulted values back into process.env so
  // the rest of the application can use them as before
  const env = result.data;
  process.env.NODE_ENV = env.NODE_ENV;
  process.env.ENABLE_API_DOCS = String(env.ENABLE_API_DOCS);
  process.env.PORT = String(env.PORT);
  process.env.JWT_ACCESS_EXPIRES_IN = env.JWT_ACCESS_EXPIRES_IN;
  process.env.JWT_REFRESH_EXPIRES_IN = env.JWT_REFRESH_EXPIRES_IN;
  // P1-9: No conditional — JWT_REFRESH_SECRET is now always present
  process.env.JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;
  if (env.COOKIE_SECRET) process.env.COOKIE_SECRET = env.COOKIE_SECRET;
  if (env.COOKIE_DOMAIN) process.env.COOKIE_DOMAIN = env.COOKIE_DOMAIN;
  process.env.COOKIE_SECURE = String(env.COOKIE_SECURE);
  process.env.COOKIE_SAME_SITE = env.COOKIE_SAME_SITE;
  process.env.CORS_ORIGINS = env.CORS_ORIGINS;
  if (env.GOOGLE_CLIENT_ID) process.env.GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
  if (env.GMAIL_USER) process.env.GMAIL_USER = env.GMAIL_USER;
  if (env.GMAIL_APP_PASSWORD) process.env.GMAIL_APP_PASSWORD = env.GMAIL_APP_PASSWORD;
  if (env.CALENDAR_FEED_SECRET) process.env.CALENDAR_FEED_SECRET = env.CALENDAR_FEED_SECRET;
  if (env.ARKESEL_API_KEY) process.env.ARKESEL_API_KEY = env.ARKESEL_API_KEY;
  if (env.ARKESEL_SENDER_ID) process.env.ARKESEL_SENDER_ID = env.ARKESEL_SENDER_ID;
  if (env.META_WA_PHONE_NUMBER_ID) process.env.META_WA_PHONE_NUMBER_ID = env.META_WA_PHONE_NUMBER_ID;
  if (env.META_WA_ACCESS_TOKEN) process.env.META_WA_ACCESS_TOKEN = env.META_WA_ACCESS_TOKEN;
  if (env.META_WA_BUSINESS_ACCOUNT_ID) process.env.META_WA_BUSINESS_ACCOUNT_ID = env.META_WA_BUSINESS_ACCOUNT_ID;
  process.env.RATE_LIMIT_WINDOW_MS = String(env.RATE_LIMIT_WINDOW_MS);
  process.env.RATE_LIMIT_MAX_REQUESTS = String(env.RATE_LIMIT_MAX_REQUESTS);
  process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = String(env.AUTH_RATE_LIMIT_MAX_REQUESTS);
  process.env.LOG_LEVEL = env.LOG_LEVEL;

  // ── P0: loud, non-blocking warning. Intranet HTTP deployments are legal,
  // but the operator must consciously acknowledge cookie exposure.
  if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
    console.error('⚠️  COOKIE_SECURE=false in production — session cookies will be transmitted over plain HTTP.');
    console.error('   Set COOKIE_SECURE=true (and serve via HTTPS) before real traffic is accepted.');
  }
}

// ── EXECUTE IMMEDIATELY ON IMPORT ──
validateEnv();
