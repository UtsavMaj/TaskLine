import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { prisma } from '../src/lib/prisma';
import { api, createUser, PASSWORD, uniqueEmail } from './helpers';

describe('POST /api/auth/register', () => {
  it('creates an account and never returns the password hash', async () => {
    const email = uniqueEmail('new');
    const res = await api()
      .post('/api/auth/register')
      .set('x-client-platform', 'mobile')
      .send({ fullName: '  Asha Rao ', email: email.toUpperCase(), password: PASSWORD })
      .expect(201);

    expect(res.body.user).toMatchObject({ fullName: 'Asha Rao', email, role: 'USER' });
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.passwordHash).not.toBe(PASSWORD);
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt
  });

  it('rejects a duplicate email (case-insensitive) with 409', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/auth/register')
      .send({ fullName: 'Someone Else', email: user.email.toUpperCase(), password: PASSWORD })
      .expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('validates every field and reports them individually', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ fullName: ' ', email: 'not-an-email', password: 'short' })
      .expect(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field).sort();
    expect(fields).toEqual(['email', 'fullName', 'password']);
  });

  it('sets the refresh token as an httpOnly cookie for browsers instead of returning it', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ fullName: 'Web User', email: uniqueEmail('web'), password: PASSWORD })
      .expect(201);
    expect(res.body.refreshToken).toBeUndefined();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/taskline_rt=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with the right password', async () => {
    const user = await createUser();
    const res = await api().post('/api/auth/login').send({ email: user.email, password: PASSWORD }).expect(200);
    expect(res.body.user.email).toBe(user.email);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const user = await createUser();
    const wrong = await api().post('/api/auth/login').send({ email: user.email, password: 'Wrong-pass-1' }).expect(401);
    const unknown = await api()
      .post('/api/auth/login')
      .send({ email: uniqueEmail('ghost'), password: 'Wrong-pass-1' })
      .expect(401);
    expect(wrong.body.error.message).toBe('Invalid email or password');
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });
});

describe('protected routes', () => {
  it('GET /api/auth/me returns the current user', async () => {
    const user = await createUser('Me Myself');
    const res = await api().get('/api/auth/me').set(user.auth).expect(200);
    expect(res.body.user).toMatchObject({ id: user.user.id, fullName: 'Me Myself' });
  });

  it('rejects missing, malformed and tampered tokens', async () => {
    await api().get('/api/auth/me').expect(401);
    await api().get('/api/auth/me').set('Authorization', 'Bearer nope').expect(401);

    const user = await createUser();
    const [header, payload] = user.accessToken.split('.');
    const forged = `${header}.${payload}.${Buffer.from('fake-signature').toString('base64url')}`;
    await api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`).expect(401);
  });

  it('reports TOKEN_EXPIRED for an expired access token', async () => {
    const user = await createUser();
    const decoded = jwt.decode(user.accessToken) as { sub: string; sid: string };
    const expired = jwt.sign(
      { sid: decoded.sid, role: 'USER', exp: Math.floor(Date.now() / 1000) - 10 },
      process.env.JWT_ACCESS_SECRET!,
      { subject: decoded.sub, issuer: 'taskline-api', audience: 'taskline-clients' },
    );
    const res = await api().get('/api/projects').set('Authorization', `Bearer ${expired}`).expect(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects tokens signed with alg "none"', async () => {
    const user = await createUser();
    const decoded = jwt.decode(user.accessToken) as Record<string, unknown>;
    const unsigned = jwt.sign(decoded, '', { algorithm: 'none' });
    await api().get('/api/auth/me').set('Authorization', `Bearer ${unsigned}`).expect(401);
  });
});

describe('refresh tokens', () => {
  it('rotates the refresh token and detects reuse of an old one', async () => {
    const user = await createUser();
    const first = user.refreshToken!;

    const rotated = await api()
      .post('/api/auth/refresh')
      .set('x-client-platform', 'mobile')
      .send({ refreshToken: first })
      .expect(200);
    const second = rotated.body.refreshToken as string;
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    await api().get('/api/auth/me').set('Authorization', `Bearer ${rotated.body.accessToken}`).expect(200);

    // Rotate again so `first` is now two generations old (outside the grace window logic).
    await api().post('/api/auth/refresh').set('x-client-platform', 'mobile').send({ refreshToken: second }).expect(200);

    const replay = await api()
      .post('/api/auth/refresh')
      .set('x-client-platform', 'mobile')
      .send({ refreshToken: first })
      .expect(401);
    expect(replay.body.error.code).toBe('SESSION_EXPIRED');

    // The whole session is revoked after a replay, so even the access token stops working.
    await api().get('/api/auth/me').set('Authorization', `Bearer ${rotated.body.accessToken}`).expect(401);
  });

  it('refreshes from the cookie for browsers and requires the client header', async () => {
    const agent = api();
    const login = await api()
      .post('/api/auth/register')
      .send({ fullName: 'Cookie User', email: uniqueEmail('cookie'), password: PASSWORD })
      .expect(201);
    const cookie = String(login.headers['set-cookie']).split(';')[0]!;

    // A cross-site form post can't add custom headers, so this is rejected.
    await agent.post('/api/auth/refresh').set('Cookie', cookie).expect(400);

    const res = await api().post('/api/auth/refresh').set('Cookie', cookie).set('x-client-platform', 'web').expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toBeUndefined();
    expect(String(res.headers['set-cookie'])).toMatch(/taskline_rt=/);
  });

  it('rejects garbage refresh tokens', async () => {
    await api()
      .post('/api/auth/refresh')
      .set('x-client-platform', 'mobile')
      .send({ refreshToken: 'definitely-not-a-token' })
      .expect(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('ends the session immediately, the access token stops working', async () => {
    const user = await createUser();
    await api().post('/api/auth/logout').set(user.auth).expect(204);

    const res = await api().get('/api/auth/me').set(user.auth).expect(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');

    await api()
      .post('/api/auth/refresh')
      .set('x-client-platform', 'mobile')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });

  it('only ends the current device session', async () => {
    const user = await createUser();
    const other = await api()
      .post('/api/auth/login')
      .set('x-client-platform', 'mobile')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);

    await api().post('/api/auth/logout').set(user.auth).expect(204);
    await api().get('/api/auth/me').set('Authorization', `Bearer ${other.body.accessToken}`).expect(200);
  });
});
