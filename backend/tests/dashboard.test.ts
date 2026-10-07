import { describe, expect, it } from 'vitest';

import { api, createProject, createTask, createUser } from './helpers';

describe('GET /api/dashboard', () => {
  it('returns zeros for a brand new account', async () => {
    const user = await createUser();
    const res = await api().get('/api/dashboard').set(user.auth).expect(200);
    expect(res.body).toMatchObject({
      totalProjects: 0,
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      projectsInProgress: 0,
      completionRate: 0,
      upcomingTasks: [],
    });
  });

  it('counts only the signed-in user’s data', async () => {
    const user = await createUser('Busy');
    const someoneElse = await createUser('Noise');

    const p1 = await createProject(user, { status: 'IN_PROGRESS' });
    const p2 = await createProject(user, { status: 'NOT_STARTED' });
    await createProject(user, { status: 'IN_PROGRESS' });

    await createTask(user, p1.id, { status: 'COMPLETED' });
    await createTask(user, p1.id, { status: 'PENDING', dueDate: '2020-01-01' }); // overdue
    await createTask(user, p2.id, { status: 'PENDING', dueDate: '2099-01-01' });
    await createTask(user, p2.id, { status: 'IN_PROGRESS' });

    const noise = await createProject(someoneElse, { status: 'IN_PROGRESS' });
    await createTask(someoneElse, noise.id, { status: 'COMPLETED' });

    const res = await api().get('/api/dashboard?today=2026-06-01').set(user.auth).expect(200);
    expect(res.body).toMatchObject({
      totalProjects: 3,
      totalTasks: 4,
      completedTasks: 1,
      pendingTasks: 2,
      inProgressTasks: 1,
      overdueTasks: 1,
      projectsInProgress: 2,
      completionRate: 25,
      projectsByStatus: { NOT_STARTED: 1, IN_PROGRESS: 2, COMPLETED: 0 },
    });
    expect(res.body.upcomingTasks.map((t: { dueDate: string }) => t.dueDate)).toEqual(['2020-01-01', '2099-01-01']);
  });

  it('validates the optional date', async () => {
    const user = await createUser();
    await api().get('/api/dashboard?today=yesterday').set(user.auth).expect(400);
  });

  it('requires authentication', async () => {
    await api().get('/api/dashboard').expect(401);
  });
});

describe('activity log and RBAC', () => {
  it('records the user’s own actions', async () => {
    const user = await createUser();
    const project = await createProject(user, { name: 'Logged project' });
    const task = await createTask(user, project.id, { name: 'Logged task' });
    await api().put(`/api/tasks/${task.id}`).set(user.auth).send({ status: 'COMPLETED' }).expect(200);

    const res = await api().get('/api/audit-logs').set(user.auth).expect(200);
    const actions = res.body.data.map((entry: { action: string }) => entry.action);
    expect(actions).toEqual(['TASK_COMPLETED', 'TASK_CREATED', 'PROJECT_CREATED', 'USER_REGISTERED']);
  });

  it('keeps admin routes for admins only', async () => {
    const user = await createUser();
    const res = await api().get('/api/admin/users').set(user.auth).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
