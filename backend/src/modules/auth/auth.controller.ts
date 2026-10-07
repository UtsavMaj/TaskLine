import { CLIENT_HEADER, type AuthResponse, type LoginData, type RegisterData, type User } from '@taskline/shared';
import type { CookieOptions, Request, Response } from 'express';

import { env } from '../../config/env';
import { getAuth } from '../../middleware/authenticate';
import * as authService from './auth.service';
import type { ClientMeta, IssuedTokens } from './auth.service';

/**
 * Two kinds of clients share these endpoints:
 *  - the browser keeps the refresh token in an httpOnly cookie (JavaScript can't read it),
 *  - the Android app sends `x-client-platform: mobile` and gets it in the body, then stores
 *    it in the Keystore via expo-secure-store.
 * The access token is always returned in the body and sent back as a Bearer header.
 */
export const REFRESH_COOKIE = 'taskline_rt';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/auth', // only sent to refresh/logout, never to the rest of the API
};

function isMobile(req: Request) {
  return req.get(CLIENT_HEADER)?.toLowerCase() === 'mobile';
}

function clientMeta(req: Request): ClientMeta {
  return { ip: req.ip, userAgent: req.get('user-agent'), platform: isMobile(req) ? 'mobile' : 'web' };
}

function sendAuth(req: Request, res: Response, status: number, user: User, tokens: IssuedTokens) {
  const body: AuthResponse = {
    user,
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
  };

  if (tokens.refreshToken && tokens.refreshTokenExpiresAt) {
    if (isMobile(req)) {
      body.refreshToken = tokens.refreshToken;
      body.refreshTokenExpiresAt = tokens.refreshTokenExpiresAt.toISOString();
    } else {
      res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...cookieOptions, expires: tokens.refreshTokenExpiresAt });
    }
  }

  res.set('Cache-Control', 'no-store');
  res.status(status).json(body);
}

export async function register(req: Request, res: Response) {
  const { user, tokens } = await authService.register(req.body as RegisterData, clientMeta(req));
  req.log.info({ userId: user.id }, 'User registered');
  sendAuth(req, res, 201, user, tokens);
}

export async function login(req: Request, res: Response) {
  const { user, tokens } = await authService.login(req.body as LoginData, clientMeta(req));
  req.log.info({ userId: user.id, platform: clientMeta(req).platform }, 'User logged in');
  sendAuth(req, res, 200, user, tokens);
}

export async function refresh(req: Request, res: Response) {
  const fromBody = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
  const fromCookie = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  try {
    const { user, tokens } = await authService.refresh(
      isMobile(req) ? fromBody : (fromCookie ?? fromBody),
      clientMeta(req),
    );
    sendAuth(req, res, 200, user, tokens);
  } catch (error) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    throw error;
  }
}

export async function logout(req: Request, res: Response) {
  const auth = getAuth(req);
  await authService.logout(auth.userId, auth.sessionId, clientMeta(req));
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  req.log.info({ userId: auth.userId }, 'User logged out');
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  const user = await authService.getProfile(getAuth(req).userId);
  res.json({ user });
}
