import { describe, expect, it } from 'vitest';

import {
  buildRefreshToken,
  generateRefreshSecret,
  hashesMatch,
  hashSecret,
  parseRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../src/lib/tokens';

// Pure unit tests, no database involved.
describe('access tokens', () => {
  it('round-trips the claims', () => {
    const { token, expiresAt } = signAccessToken({ sub: 'user-1', sid: 'session-1', role: 'USER' });
    expect(verifyAccessToken(token)).toEqual({ sub: 'user-1', sid: 'session-1', role: 'USER' });
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a token signed with a different secret', async () => {
    const jwt = await import('jsonwebtoken');
    const foreign = jwt.default.sign({ sid: 's' }, 'another-secret-another-secret-another', {
      subject: 'u',
      issuer: 'taskline-api',
      audience: 'taskline-clients',
    });
    expect(() => verifyAccessToken(foreign)).toThrow();
  });
});

describe('refresh tokens', () => {
  const sessionId = '0f8c3c3e-6c1f-4b8e-9a5d-2f8e2d1b7c40';

  it('builds and parses "<session>.<secret>"', () => {
    const secret = generateRefreshSecret();
    expect(parseRefreshToken(buildRefreshToken(sessionId, secret))).toEqual({ sessionId, secret });
  });

  it.each([undefined, '', 'abc', `${sessionId}.short`, `not-a-uuid.${'x'.repeat(40)}`])('rejects %s', (value) => {
    expect(parseRefreshToken(value)).toBeNull();
  });

  it('stores only a hash and compares it in constant time', () => {
    const secret = generateRefreshSecret();
    const hash = hashSecret(secret);
    expect(hash).not.toContain(secret);
    expect(hashesMatch(hash, hashSecret(secret))).toBe(true);
    expect(hashesMatch(hash, hashSecret(`${secret}x`))).toBe(false);
  });
});
