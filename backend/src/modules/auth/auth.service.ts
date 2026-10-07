import type { Prisma, User } from '@prisma/client';
import { ERROR_CODES, type LoginData, type RegisterData } from '@taskline/shared';

import { AUDIT_ACTIONS, recordAudit } from '../../lib/audit';
import { HttpError } from '../../lib/http-error';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import { serializeUser } from '../../lib/serializers';
import {
  buildRefreshToken,
  generateRefreshSecret,
  hashesMatch,
  hashSecret,
  parseRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from '../../lib/tokens';

export interface ClientMeta {
  ip?: string | null;
  userAgent?: string | null;
  platform: 'web' | 'mobile';
}

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  /** Absent when an old-but-still-in-grace token was used: the client already has the newer one. */
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
}

/** How long the previous refresh token keeps working after a rotation (parallel requests, two tabs). */
const ROTATION_GRACE_MS = 60 * 1000;

const sessionExpired = () =>
  HttpError.unauthorized('Your session has expired, please sign in again', ERROR_CODES.SESSION_EXPIRED);

async function openSession(tx: Prisma.TransactionClient, user: Pick<User, 'id' | 'role'>, meta: ClientMeta) {
  const now = new Date();
  // House-keeping: drop this user's dead sessions so the table doesn't grow forever.
  await tx.session.deleteMany({
    where: { userId: user.id, OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null } }] },
  });

  const secret = generateRefreshSecret();
  const session = await tx.session.create({
    data: {
      userId: user.id,
      tokenHash: hashSecret(secret),
      expiresAt: refreshTokenExpiry(),
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ipAddress: meta.ip ?? null,
    },
  });

  const access = signAccessToken({ sub: user.id, sid: session.id, role: user.role });
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken: buildRefreshToken(session.id, secret),
    refreshTokenExpiresAt: session.expiresAt,
  } satisfies IssuedTokens;
}

export async function register(data: RegisterData, meta: ClientMeta) {
  const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existing) {
    throw HttpError.conflict('An account with this email already exists', [
      { field: 'email', message: 'This email is already registered' },
    ]);
  }

  const passwordHash = await hashPassword(data.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { fullName: data.fullName, email: data.email, passwordHash },
    });
    const tokens = await openSession(tx, user, meta);
    await recordAudit(tx, {
      userId: user.id,
      action: AUDIT_ACTIONS.USER_REGISTERED,
      entityType: 'USER',
      entityId: user.id,
      summary: `Created an account on ${meta.platform}`,
      ipAddress: meta.ip,
    });
    return { user: serializeUser(user), tokens };
  });
}

export async function login(data: LoginData, meta: ClientMeta) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });

  const passwordOk = user
    ? await verifyPassword(data.password, user.passwordHash)
    : await burnPasswordCheck(data.password);

  // Same message for "no such email" and "wrong password" so accounts can't be enumerated.
  if (!user || !passwordOk) {
    throw new HttpError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password');
  }

  return prisma.$transaction(async (tx) => {
    const tokens = await openSession(tx, user, meta);
    await recordAudit(tx, {
      userId: user.id,
      action: AUDIT_ACTIONS.USER_LOGGED_IN,
      entityType: 'USER',
      entityId: user.id,
      summary: `Signed in on ${meta.platform}`,
      ipAddress: meta.ip,
    });
    return { user: serializeUser(user), tokens };
  });
}

/**
 * Exchanges a refresh token for a new access token and rotates the refresh token.
 * Presenting an old token outside the grace window means it was copied or replayed,
 * so the whole session is revoked.
 */
export async function refresh(rawToken: string | undefined, meta: ClientMeta) {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed) throw sessionExpired();

  const session = await prisma.session.findUnique({
    where: { id: parsed.sessionId },
    include: { user: true },
  });
  const now = new Date();
  if (!session || session.revokedAt || session.expiresAt <= now) throw sessionExpired();

  const presentedHash = hashSecret(parsed.secret);

  if (hashesMatch(presentedHash, session.tokenHash)) {
    const secret = generateRefreshSecret();
    const expiresAt = refreshTokenExpiry();
    // Compare-and-swap on the current hash: if a parallel request rotated first, count is 0.
    const { count } = await prisma.session.updateMany({
      where: { id: session.id, tokenHash: session.tokenHash, revokedAt: null },
      data: {
        tokenHash: hashSecret(secret),
        previousTokenHash: session.tokenHash,
        rotatedAt: now,
        expiresAt,
        lastUsedAt: now,
        ipAddress: meta.ip ?? session.ipAddress,
      },
    });
    const access = signAccessToken({ sub: session.userId, sid: session.id, role: session.user.role });
    const tokens: IssuedTokens = { accessToken: access.token, accessTokenExpiresAt: access.expiresAt };
    if (count === 1) {
      tokens.refreshToken = buildRefreshToken(session.id, secret);
      tokens.refreshTokenExpiresAt = expiresAt;
    }
    return { user: serializeUser(session.user), tokens };
  }

  const inGrace =
    session.previousTokenHash &&
    session.rotatedAt &&
    now.getTime() - session.rotatedAt.getTime() < ROTATION_GRACE_MS &&
    hashesMatch(presentedHash, session.previousTokenHash);

  if (inGrace) {
    const access = signAccessToken({ sub: session.userId, sid: session.id, role: session.user.role });
    return {
      user: serializeUser(session.user),
      tokens: { accessToken: access.token, accessTokenExpiresAt: access.expiresAt } satisfies IssuedTokens,
    };
  }

  // Token reuse: someone is holding an old refresh token. Kill the session for everyone.
  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: now } });
  throw sessionExpired();
}

export async function logout(userId: string, sessionId: string, meta: ClientMeta) {
  await prisma.$transaction(async (tx) => {
    await tx.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    // This phone shouldn't keep getting reminders for an account that signed out of it.
    await tx.pushToken.deleteMany({ where: { sessionId } });
    await recordAudit(tx, {
      userId,
      action: AUDIT_ACTIONS.USER_LOGGED_OUT,
      entityType: 'USER',
      entityId: userId,
      summary: `Signed out on ${meta.platform}`,
      ipAddress: meta.ip,
    });
  });
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw HttpError.unauthorized();
  return serializeUser(user);
}
