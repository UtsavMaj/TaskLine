import 'dotenv/config';

import { z } from 'zod';

/**
 * All configuration comes from environment variables and is validated once at boot.
 * A bad or missing value stops the server immediately with a readable message,
 * instead of failing later on the first request.
 */

const booleanFromString = z.enum(['true', 'false', '1', '0']).transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  // Comma separated list of browser origins allowed to call the API, e.g. https://taskline.vercel.app
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  // "lax" when web and API share a site (same domain or proxied), "none" when they are on different domains.
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: booleanFromString.optional(),
  // Number of proxies in front of the app (Render, Railway, Nginx...). Needed for correct client IPs in rate limiting.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
  API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // "Due tomorrow" push reminders (Expo push service)
  REMINDER_HOUR: z.coerce.number().int().min(0).max(23).default(18),
  // Run the reminder check every 15 minutes inside this process. Hosts that sleep when idle
  // (Render free tier) should call POST /api/jobs/due-reminders from a cron instead.
  REMINDER_SCHEDULER: booleanFromString.default(true),
  // Shared secret for POST /api/jobs/due-reminders. The endpoint is disabled when unset.
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters').optional(),
  // Optional: only needed if "enhanced push security" is turned on for the Expo project.
  EXPO_ACCESS_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
  // Logger is not ready yet (it depends on this file), so plain stderr it is.
  console.error(`\nInvalid environment configuration:\n${problems}\n\nSee backend/.env.example for every variable.\n`);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
  // SameSite=None is only accepted by browsers together with Secure.
  cookieSecure: raw.COOKIE_SECURE ?? (raw.NODE_ENV === 'production' || raw.COOKIE_SAMESITE === 'none'),
};

export type Env = typeof env;
