import { beforeAll, describe, expect, it } from 'vitest';

import { api, createProject, createTask, createUser, type TestUser } from './helpers';

let owner: TestUser;
let stranger: TestUser;
let projectId: string;

beforeAll(async () => {
  owner = await createUser('Task Owner');
  stranger = await createUser('Task Stranger');
  projectId = (await createProject(owner, { name: 'Thesis' })).id;
});

describe('task CRUD', () => {
  it('creates a task with defaults', async () => {
    const res = await api()
      .post('/api/tasks')
      .set(owner.auth)
      .send({ projectId, name: 'Write abstract', dueDate: '2026-12-01' })
      .expect(201);
    expect(res.body.task).toMatchObject({
      projectId,
      project: { id: projectId, name: 'Thesis' },
      name: 'Write abstract',
      priority: 'MEDIUM',
      status: 'PENDING',
      dueDate: '2026-12-01',
      completedAt: null,
    });
  });

  it('marks a task as completed and back again', async () => {
    const task = await createTask(owner, projectId);

    const done = await api().put(`/api/tasks/${task.id}`).set(owner.auth).send({ status: 'COMPLETED' }).expect(200);
    expect(done.body.task.status).toBe('COMPLETED');
    expect(done.body.task.completedAt).toEqual(expect.any(String));

    const reopened = await api()
      .put(`/api/tasks/${task.id}`)
      .set(owner.auth)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect(reopened.body.task.completedAt).toBeNull();
  });

  it('edits fields and clears the due date', async () => {
    const task = await createTask(owner, projectId, { dueDate: '2026-11-11' });
    const res = await api()
      .put(`/api/tasks/${task.id}`)
      .set(owner.auth)
      .send({ name: 'Renamed', priority: 'HIGH', dueDate: null, description: 'More detail' })
      .expect(200);
    expect(res.body.task).toMatchObject({
      name: 'Renamed',
      priority: 'HIGH',
      dueDate: null,
      description: 'More detail',
    });
  });

  it('deletes a task', async () => {
    const task = await createTask(owner, projectId);
    await api().delete(`/api/tasks/${task.id}`).set(owner.auth).expect(204);
    await api().get(`/api/tasks/${task.id}`).set(owner.auth).expect(404);
  });

  it('can move a task to another of the user’s projects', async () => {
    const other = await createProject(owner, { name: 'Side project' });
    const task = await createTask(owner, projectId);
    const res = await api().put(`/api/tasks/${task.id}`).set(owner.auth).send({ projectId: other.id }).expect(200);
    expect(res.body.task.project.name).toBe('Side project');
  });
});

describe('task validation', () => {
  it.each([
    [{ projectId: undefined, name: 'No project' }, 'projectId'],
    [{ projectId: 'abc', name: 'Bad id' }, 'projectId'],
    [{ name: '' }, 'name'],
    [{ name: 'x', priority: 'URGENT' }, 'priority'],
    [{ name: 'x', status: 'DONE' }, 'status'],
    [{ name: 'x', dueDate: '2026-13-01' }, 'dueDate'],
  ])('rejects %j', async (body, field) => {
    const payload = 'projectId' in body ? body : { projectId, ...body };
    const res = await api().post('/api/tasks').set(owner.auth).send(payload).expect(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
  });
});

describe('task list: search and filters', () => {
  let user: TestUser;
  let listProject: string;

  beforeAll(async () => {
    user = await createUser('Filter Fan');
    listProject = (await createProject(user, { name: 'Filters' })).id;
    const other = (await createProject(user, { name: 'Elsewhere' })).id;
    await createTask(user, listProject, { name: 'Design login screen', priority: 'HIGH', status: 'IN_PROGRESS' });
    await createTask(user, listProject, { name: 'Design dashboard', priority: 'LOW', status: 'PENDING' });
    await createTask(user, listProject, { name: 'Write tests', priority: 'HIGH', status: 'COMPLETED' });
    await createTask(user, other, { name: 'Design poster', priority: 'MEDIUM' });
  });

  it('lists every task of the user across projects', async () => {
    const res = await api().get('/api/tasks').set(user.auth).expect(200);
    expect(res.body.meta.total).toBe(4);
  });

  it('scopes to one project', async () => {
    const res = await api().get(`/api/tasks?projectId=${listProject}`).set(user.auth).expect(200);
    expect(res.body.meta.total).toBe(3);
  });

  it('searches by name', async () => {
    const res = await api().get(`/api/tasks?projectId=${listProject}&search=design`).set(user.auth).expect(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('filters by status and priority together', async () => {
    const res = await api().get('/api/tasks?status=IN_PROGRESS&priority=HIGH').set(user.auth).expect(200);
    expect(res.body.data.map((t: { name: string }) => t.name)).toEqual(['Design login screen']);
  });

  it('sorts by priority', async () => {
    const res = await api()
      .get(`/api/tasks?projectId=${listProject}&sortBy=priority&order=desc`)
      .set(user.auth)
      .expect(200);
    expect(res.body.data.map((t: { priority: string }) => t.priority)).toEqual(['HIGH', 'HIGH', 'LOW']);
  });
});

describe('task list: due date filter', () => {
  it('returns only tasks due on the given day', async () => {
    const user = await createUser('Planner');
    const project = await createProject(user);
    await createTask(user, project.id, { name: 'Due on the first', dueDate: '2031-05-01' });
    await createTask(user, project.id, { name: 'Due on the second', dueDate: '2031-05-02' });

    const res = await api().get('/api/tasks?dueOn=2031-05-01').set(user.auth).expect(200);
    expect(res.body.data.map((t: { name: string }) => t.name)).toEqual(['Due on the first']);
    await api().get('/api/tasks?dueOn=tomorrow').set(user.auth).expect(400);
  });
});

describe('task authorization', () => {
  it('cannot add a task to someone else’s project', async () => {
    await api().post('/api/tasks').set(stranger.auth).send({ projectId, name: 'Intrusion' }).expect(404);
  });

  it('cannot read, edit, complete or delete someone else’s task', async () => {
    const task = await createTask(owner, projectId, { name: 'Mine' });
    await api().get(`/api/tasks/${task.id}`).set(stranger.auth).expect(404);
    await api().put(`/api/tasks/${task.id}`).set(stranger.auth).send({ status: 'COMPLETED' }).expect(404);
    await api().delete(`/api/tasks/${task.id}`).set(stranger.auth).expect(404);

    const res = await api().get(`/api/tasks/${task.id}`).set(owner.auth).expect(200);
    expect(res.body.task.status).toBe('PENDING');
  });

  it('cannot list another user’s project tasks or move a task into their project', async () => {
    await api().get(`/api/tasks?projectId=${projectId}`).set(stranger.auth).expect(404);

    const strangerProject = await createProject(stranger);
    const task = await createTask(owner, projectId);
    await api().put(`/api/tasks/${task.id}`).set(owner.auth).send({ projectId: strangerProject.id }).expect(404);
  });
});
