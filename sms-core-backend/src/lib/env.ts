/* eslint-disable no-console */
import { z } from 'zod';

const envSchema = z.object({
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
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.coerce.string().transform(v => v === 'true').default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(100),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(5),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

/**
 * Validates all environment variables at startup.
 * Must be imported AFTER dotenv/config so .env values are loaded.
 * Throws immediately if required variables are missing or invalid.
 */
function validateEnv() {
  const result = envSchema.safeParse(process.env);

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
  process.env.RATE_LIMIT_WINDOW_MS = String(env.RATE_LIMIT_WINDOW_MS);
  process.env.RATE_LIMIT_MAX_REQUESTS = String(env.RATE_LIMIT_MAX_REQUESTS);
  process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = String(env.AUTH_RATE_LIMIT_MAX_REQUESTS);
  process.env.LOG_LEVEL = env.LOG_LEVEL;
}

// ── EXECUTE IMMEDIATELY ON IMPORT ──
validateEnv();
