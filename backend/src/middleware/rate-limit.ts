import { ERROR_CODES } from '@taskline/shared';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

import { env } from '../config/env';
import { logger } from '../lib/logger';

function tooManyRequests(message: string) {
  return (req: Request, res: Response) => {
    logger.warn({ ip: req.ip, path: req.originalUrl }, 'Rate limit hit');
    res.status(429).json({ error: { code: ERROR_CODES.RATE_LIMITED, message } });
  };
}

const windowMs = env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

/**
 * Brute-force protection for login: N failed attempts per IP per window.
 * Successful logins don't count, so a user who types the password right isn't punished.
 */
export const loginLimiter = rateLimit({
  windowMs,
  limit: env.AUTH_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooManyRequests(
    `Too many login attempts. Please wait ${env.AUTH_RATE_LIMIT_WINDOW_MINUTES} minutes and try again.`,
  ),
});

/** Stops scripted sign-ups and token-refresh hammering from a single IP. */
export const authLimiter = rateLimit({
  windowMs,
  limit: env.AUTH_RATE_LIMIT_MAX * 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooManyRequests('Too many requests. Please slow down and try again later.'),
});

/** A loose global cap for every API route. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.API_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooManyRequests('Too many requests. Please slow down and try again in a minute.'),
});
