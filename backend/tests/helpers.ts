import { randomUUID } from 'node:crypto';

import type { AuthResponse } from '@taskline/shared';
import request from 'supertest';

import { createApp } from '../src/app';

export const app = createApp();
export const api = () => request(app);

export const PASSWORD = 'Sup3rSecret!';

export function uniqueEmail(prefix = 'user') {
  return `${prefix}.${randomUUID().slice(0, 8)}@example.test`;
}

/** Registers a fresh user as the mobile client would, so the refresh token comes back in the body. */
export async function createUser(name = 'Test User') {
  const email = uniqueEmail();
  const res = await api()
    .post('/api/auth/register')
    .set('x-client-platform', 'mobile')
    .send({ fullName: name, email, password: PASSWORD })
    .expect(201);
  const body = res.body as AuthResponse;
  return {
    ...body,
    email,
    auth: { Authorization: `Bearer ${body.accessToken}` },
  };
}

export type TestUser = Awaited<ReturnType<typeof createUser>>;

export async function createProject(user: TestUser, overrides: Record<string, unknown> = {}) {
  const res = await api()
    .post('/api/projects')
    .set(user.auth)
    .send({ name: 'Test project', status: 'IN_PROGRESS', ...overrides })
    .expect(201);
  return res.body.project as { id: string; name: string };
}

export async function createTask(user: TestUser, projectId: string, overrides: Record<string, unknown> = {}) {
  const res = await api()
    .post('/api/tasks')
    .set(user.auth)
    .send({ projectId, name: 'Test task', ...overrides })
    .expect(201);
  return res.body.task as { id: string; name: string; status: string };
}
