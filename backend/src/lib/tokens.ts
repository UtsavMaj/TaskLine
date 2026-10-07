import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import type { UserRole } from '@taskline/shared';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';

const ISSUER = 'taskline-api';
const AUDIENCE = 'taskline-clients';

export interface AccessTokenClaims {
  /** user id */
  sub: string;
  /** session id, lets logout invalidate the access token right away */
  sid: string;
  role: UserRole;
}

export function signAccessToken(claims: AccessTokenClaims) {
  const expiresInSeconds = env.ACCESS_TOKEN_TTL_MINUTES * 60;
  const token = jwt.sign({ sid: claims.sid, role: claims.role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: claims.sub,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: expiresInSeconds,
  });
  return { token, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
}

/** Throws jsonwebtoken's TokenExpiredError / JsonWebTokenError, the auth middleware tells them apart. */
export function verifyAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'], // pinned, so a token with alg "none" or RS256 is never accepted
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (typeof payload === 'string' || !payload.sub || typeof payload.sid !== 'string') {
    throw new jwt.JsonWebTokenError('Malformed token payload');
  }
  return { sub: payload.sub, sid: payload.sid, role: payload.role as UserRole };
}

// ---- Refresh tokens -------------------------------------------------------
// Format: "<sessionId>.<secret>". The secret is 48 random bytes; the DB only keeps sha256(secret),
// so a leaked database dump can't be used to sign in.

export function generateRefreshSecret() {
  return randomBytes(48).toString('base64url');
}

export function hashSecret(secret: string) {
  return createHash('sha256').update(secret).digest('hex');
}

export function buildRefreshToken(sessionId: string, secret: string) {
  return `${sessionId}.${secret}`;
}

export function parseRefreshToken(token: string | undefined | null) {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const sessionId = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || secret.length < 32) return null;
  return { sessionId, secret };
}

/** Constant-time comparison of two hex digests. */
export function hashesMatch(a: string, b: string) {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function refreshTokenExpiry() {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
