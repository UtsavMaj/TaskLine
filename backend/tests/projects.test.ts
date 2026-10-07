import { beforeAll, describe, expect, it } from 'vitest';

import { api, createProject, createTask, createUser, type TestUser } from './helpers';

let owner: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  owner = await createUser('Owner');
  stranger = await createUser('Stranger');
});

describe('project CRUD', () => {
  it('creates, reads, updates and deletes a project', async () => {
    const created = await api()
      .post('/api/projects')
      .set(owner.auth)
      .send({
        name: '  Lab report  ',
        description: 'Chemistry lab write-up',
        startDate: '2026-01-10',
        endDate: '2026-01-20',
      })
      .expect(201);

    const project = created.body.project;
    expect(project).toMatchObject({
      name: 'Lab report',
      status: 'NOT_STARTED',
      startDate: '2026-01-10',
      endDate: '2026-01-20',
      taskCounts: { total: 0, completed: 0 },
      progress: 0,
    });
    expect(project.createdAt).toEqual(expect.any(String));
    expect(project).not.toHaveProperty('userId');

    const fetched = await api().get(`/api/projects/${project.id}`).set(owner.auth).expect(200);
    expect(fetched.body.project.id).toBe(project.id);

    const updated = await api()
      .put(`/api/projects/${project.id}`)
      .set(owner.auth)
      .send({ status: 'IN_PROGRESS', description: '' })
      .expect(200);
    expect(updated.body.project).toMatchObject({ status: 'IN_PROGRESS', description: null, name: 'Lab report' });

    await api().delete(`/api/projects/${project.id}`).set(owner.auth).expect(204);
    await api().get(`/api/projects/${project.id}`).set(owner.auth).expect(404);
  });

  it('reports progress from its tasks', async () => {
    const project = await createProject(owner);
    await createTask(owner, project.id, { status: 'COMPLETED' });
    await createTask(owner, project.id);
    await createTask(owner, project.id);
    await createTask(owner, project.id, { status: 'COMPLETED' });

    const res = await api().get(`/api/projects/${project.id}`).set(owner.auth).expect(200);
    expect(res.body.project.taskCounts).toEqual({ total: 4, completed: 2 });
    expect(res.body.project.progress).toBe(50);
  });

  it('deleting a project removes its tasks too', async () => {
    const project = await createProject(owner);
    const task = await createTask(owner, project.id);
    await api().delete(`/api/projects/${project.id}`).set(owner.auth).expect(204);
    await api().get(`/api/tasks/${task.id}`).set(owner.auth).expect(404);
  });
});

describe('project validation', () => {
  it.each([
    [{ name: '' }, 'name'],
    [{ name: '   ' }, 'name'],
    [{ name: 'x'.repeat(121) }, 'name'],
    [{ name: 'Ok', status: 'DONE' }, 'status'],
    [{ name: 'Ok', startDate: '2026-02-30' }, 'startDate'],
    [{ name: 'Ok', startDate: '10/01/2026' }, 'startDate'],
    [{ name: 'Ok', startDate: '2026-03-10', endDate: '2026-03-01' }, 'endDate'],
    [{ name: 123 }, 'name'],
  ])('rejects %j', async (body, field) => {
    const res = await api().post('/api/projects').set(owner.auth).send(body).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
  });

  it('checks the date range against stored values when only one date is updated', async () => {
    const project = await createProject(owner, { startDate: '2026-05-01', endDate: '2026-05-31' });
    const res = await api()
      .put(`/api/projects/${project.id}`)
      .set(owner.auth)
      .send({ endDate: '2026-04-01' })
      .expect(400);
    expect(res.body.error.details[0].field).toBe('endDate');
  });

  it('rejects an empty update', async () => {
    const project = await createProject(owner);
    await api().put(`/api/projects/${project.id}`).set(owner.auth).send({}).expect(400);
  });

  it('ignores fields that are not part of the schema (no mass assignment)', async () => {
    const res = await api()
      .post('/api/projects')
      .set(owner.auth)
      .send({ name: 'Sneaky', userId: stranger.user.id, id: '00000000-0000-4000-8000-000000000000' })
      .expect(201);
    expect(res.body.project.id).not.toBe('00000000-0000-4000-8000-000000000000');
    await api().get(`/api/projects/${res.body.project.id}`).set(stranger.auth).expect(404);
  });
});

describe('project list: search, filter, sort, paginate', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createUser('Lister');
    await createProject(user, { name: 'Alpha website', status: 'IN_PROGRESS' });
    await createProject(user, { name: 'Beta mobile app', status: 'NOT_STARTED' });
    await createProject(user, { name: 'Gamma WEBSITE redesign', status: 'COMPLETED' });
    await createProject(user, { name: 'Delta research', status: 'IN_PROGRESS' });
  });

  it('only lists the user’s own projects', async () => {
    const res = await api().get('/api/projects').set(user.auth).expect(200);
    expect(res.body.meta.total).toBe(4);
  });

  it('searches by name, case-insensitively', async () => {
    const res = await api().get('/api/projects?search=website').set(user.auth).expect(200);
    expect(res.body.data.map((p: { name: string }) => p.name).sort()).toEqual([
      'Alpha website',
      'Gamma WEBSITE redesign',
    ]);
  });

  it('filters by status', async () => {
    const res = await api().get('/api/projects?status=IN_PROGRESS').set(user.auth).expect(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((p: { status: string }) => p.status === 'IN_PROGRESS')).toBe(true);
  });

  it('sorts and paginates', async () => {
    const page1 = await api().get('/api/projects?sortBy=name&order=asc&limit=3&page=1').set(user.auth).expect(200);
    const page2 = await api().get('/api/projects?sortBy=name&order=asc&limit=3&page=2').set(user.auth).expect(200);
    expect(page1.body.data.map((p: { name: string }) => p.name)).toEqual([
      'Alpha website',
      'Beta mobile app',
      'Delta research',
    ]);
    expect(page2.body.data.map((p: { name: string }) => p.name)).toEqual(['Gamma WEBSITE redesign']);
    expect(page1.body.meta).toEqual({ page: 1, limit: 3, total: 4, totalPages: 2 });
  });

  it('treats SQL in the search box as plain text', async () => {
    const res = await api()
      .get(`/api/projects?search=${encodeURIComponent("' OR 1=1; DROP TABLE projects; --")}`)
      .set(user.auth)
      .expect(200);
    expect(res.body.data).toEqual([]);
    const after = await api().get('/api/projects').set(user.auth).expect(200);
    expect(after.body.meta.total).toBe(4);
  });

  it('rejects unknown sort fields and bad paging values', async () => {
    await api().get('/api/projects?sortBy=password').set(user.auth).expect(400);
    await api().get('/api/projects?page=0').set(user.auth).expect(400);
    await api().get('/api/projects?limit=abc').set(user.auth).expect(400);
  });
});

describe('project authorization', () => {
  it('another user cannot read, edit or delete the project', async () => {
    const project = await createProject(owner, { name: 'Private plans' });

    await api().get(`/api/projects/${project.id}`).set(stranger.auth).expect(404);
    await api().put(`/api/projects/${project.id}`).set(stranger.auth).send({ name: 'Hijacked' }).expect(404);
    await api().delete(`/api/projects/${project.id}`).set(stranger.auth).expect(404);

    const list = await api().get('/api/projects?search=Private').set(stranger.auth).expect(200);
    expect(list.body.data).toEqual([]);

    const stillThere = await api().get(`/api/projects/${project.id}`).set(owner.auth).expect(200);
    expect(stillThere.body.project.name).toBe('Private plans');
  });

  it('requires authentication', async () => {
    await api().get('/api/projects').expect(401);
    await api().post('/api/projects').send({ name: 'x' }).expect(401);
  });

  it('returns 404 for malformed ids', async () => {
    await api().get('/api/projects/not-a-uuid').set(owner.auth).expect(404);
  });
});
