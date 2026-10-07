import { ERROR_CODES } from '@taskline/shared';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { HttpError } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../lib/tokens';
import type { AuthContext } from '../types/express';

/**
 * Protects a route with a Bearer access token.
 *
 * Besides checking the JWT signature and expiry, the session behind the token must still be
 * active. That one indexed lookup is what makes logout take effect immediately instead of
 * waiting for the token to expire.
 *  - Utsav Majumdar, RA2311056010143
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw HttpError.unauthorized('Authentication required');
  }

  let claims;
  try {
    claims = verifyAccessToken(header.slice(7).trim());
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw HttpError.unauthorized('Your session has expired, please sign in again', ERROR_CODES.TOKEN_EXPIRED);
    }
    throw HttpError.unauthorized('Invalid access token');
  }

  const session = await prisma.session.findUnique({
    where: { id: claims.sid },
    select: { userId: true, revokedAt: true, expiresAt: true, user: { select: { role: true } } },
  });

  if (!session || session.userId !== claims.sub || session.revokedAt || session.expiresAt <= new Date()) {
    throw HttpError.unauthorized('Your session has ended, please sign in again', ERROR_CODES.SESSION_EXPIRED);
  }

  // Role is read from the DB rather than trusted from the token, so a demotion applies straight away.
  req.auth = { userId: claims.sub, sessionId: claims.sid, role: session.user.role };
  next();
}

/** For handlers mounted behind `authenticate`; narrows `req.auth` to a definite value. */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw HttpError.unauthorized();
  return req.auth;
}
