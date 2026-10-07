import { describe, expect, it } from 'vitest';

import { api, createUser } from './helpers';

describe('rate limiting on login', () => {
  it('blocks an IP after too many failed attempts', async () => {
    const user = await createUser();
    const max = Number(process.env.AUTH_RATE_LIMIT_MAX);

    for (let attempt = 0; attempt < max; attempt++) {
      await api().post('/api/auth/login').send({ email: user.email, password: 'Wrong-pass-1' }).expect(401);
    }

    const blocked = await api()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Wrong-pass-1' })
      .expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();
  });
});

describe('HTTP hardening', () => {
  it('sends security headers and hides the framework', async () => {
    const res = await api().get('/api/health').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('allows CORS only for the configured web origin', async () => {
    const allowed = await api().get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await api().get('/api/health').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers unknown routes and broken JSON with a clean error body', async () => {
    const missing = await api().get('/api/nope').expect(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');

    const broken = await api()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(broken.body.error.message).toBe('Request body is not valid JSON');
    expect(JSON.stringify(broken.body)).not.toMatch(/stack|at .*\.js/);
  });
});
