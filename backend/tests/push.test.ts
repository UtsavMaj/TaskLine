import { describe, expect, it, vi } from 'vitest';

import { prisma } from '../src/lib/prisma';
import type { PushMessage, PushTicket } from '../src/modules/notifications/expo-push';
import { addDays, localDateAndHour, runDueTomorrowReminders } from '../src/modules/notifications/reminders.service';
import { api, createProject, createTask, createUser } from './helpers';

const token = (suffix: string) => `ExponentPushToken[${suffix}${Math.random().toString(36).slice(2, 10)}]`;

/** A sender that records what would have been pushed and answers with "ok" tickets. */
function fakeSender(tickets?: (messages: PushMessage[]) => PushTicket[]) {
  return vi.fn(async (messages: PushMessage[]) =>
    tickets ? tickets(messages) : messages.map((_, i) => ({ status: 'ok' as const, id: `ticket-${i}` })),
  );
}

describe('time zone helpers', () => {
  it('works out the local date and hour', () => {
    const now = new Date('2026-03-10T13:00:00Z');
    expect(localDateAndHour(now, 'Asia/Kolkata')).toEqual({ date: '2026-03-10', hour: 18 });
    expect(localDateAndHour(now, 'America/New_York')).toEqual({ date: '2026-03-10', hour: 9 });
    expect(localDateAndHour(new Date('2026-03-10T20:00:00Z'), 'Asia/Tokyo')).toEqual({ date: '2026-03-11', hour: 5 });
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('POST /api/push-tokens', () => {
  it('registers a device and validates the token and time zone', async () => {
    const user = await createUser();
    const t = token('a');

    await api().post('/api/push-tokens').set(user.auth).send({ token: 'not-a-token' }).expect(400);
    await api().post('/api/push-tokens').set(user.auth).send({ token: t, timezone: 'Mars/Olympus' }).expect(400);
    await api().post('/api/push-tokens').send({ token: t }).expect(401);

    await api().post('/api/push-tokens').set(user.auth).send({ token: t, timezone: 'Asia/Kolkata' }).expect(204);
    const stored = await prisma.pushToken.findUniqueOrThrow({ where: { token: t } });
    expect(stored).toMatchObject({ userId: user.user.id, timezone: 'Asia/Kolkata' });
  });

  it('moves a token to whoever signs in on that phone next', async () => {
    const first = await createUser();
    const second = await createUser();
    const t = token('b');

    await api().post('/api/push-tokens').set(first.auth).send({ token: t }).expect(204);
    await api().post('/api/push-tokens').set(second.auth).send({ token: t }).expect(204);

    const stored = await prisma.pushToken.findUniqueOrThrow({ where: { token: t } });
    expect(stored.userId).toBe(second.user.id);
  });

  it('is removed on DELETE and when the session signs out', async () => {
    const user = await createUser();
    const a = token('c');
    const b = token('d');
    await api().post('/api/push-tokens').set(user.auth).send({ token: a }).expect(204);
    await api().delete('/api/push-tokens').set(user.auth).send({ token: a }).expect(204);
    expect(await prisma.pushToken.count({ where: { token: a } })).toBe(0);

    await api().post('/api/push-tokens').set(user.auth).send({ token: b }).expect(204);
    await api().post('/api/auth/logout').set(user.auth).expect(204);
    expect(await prisma.pushToken.count({ where: { token: b } })).toBe(0);
  });
});

describe('due-tomorrow reminder job', () => {
  // Two days from now at 13:00 UTC: 18:30 in India, 08:00/09:00 on the US east coast.
  // (Kept close to today so the test sessions, valid for 30 days, are still active.)
  const day = addDays(new Date().toISOString().slice(0, 10), 2);
  const tomorrow = addDays(day, 1);
  const now = new Date(`${day}T13:00:00Z`);

  async function setup(timezone: string) {
    const user = await createUser();
    const project = await createProject(user);
    const t = token('job');
    await api().post('/api/push-tokens').set(user.auth).send({ token: t, timezone }).expect(204);
    return { user, project, token: t };
  }

  it('sends one push listing open tasks due tomorrow, in the user’s evening', async () => {
    const { user, project, token: t } = await setup('Asia/Kolkata');
    await createTask(user, project.id, { name: 'Submit report', dueDate: tomorrow, priority: 'HIGH' });
    await createTask(user, project.id, { name: 'Already done', dueDate: tomorrow, status: 'COMPLETED' });
    await createTask(user, project.id, { name: 'Next week', dueDate: addDays(day, 7) });

    const send = fakeSender();
    await runDueTomorrowReminders({ now, send, hour: 18 });

    const sent = send.mock.calls.flatMap(([messages]) => messages).filter((m) => m.to === t);
    expect(sent).toEqual([
      expect.objectContaining({ title: '1 task is due tomorrow', body: 'Submit report', channelId: 'due-reminders' }),
    ]);

    // Running again the same evening doesn't notify twice.
    const again = fakeSender();
    await runDueTomorrowReminders({ now: new Date(`${day}T14:30:00Z`), send: again, hour: 18 });
    expect(again.mock.calls.flatMap(([m]) => m).some((m) => m.to === t)).toBe(false);
  });

  it('waits for the evening in the device’s own time zone', async () => {
    const { user, project, token: t } = await setup('America/New_York');
    await createTask(user, project.id, { name: 'Morning task', dueDate: tomorrow });

    const send = fakeSender();
    await runDueTomorrowReminders({ now, send, hour: 18 });
    expect(send.mock.calls.flatMap(([m]) => m).some((m) => m.to === t)).toBe(false);
  });

  it('skips phones whose session was revoked', async () => {
    const { user, project, token: t } = await setup('Asia/Kolkata');
    await createTask(user, project.id, { name: 'Hidden', dueDate: tomorrow });
    await prisma.session.updateMany({ where: { userId: user.user.id }, data: { revokedAt: new Date() } });

    const send = fakeSender();
    await runDueTomorrowReminders({ now, send, hour: 18 });
    expect(send.mock.calls.flatMap(([m]) => m).some((m) => m.to === t)).toBe(false);
  });

  it('forgets tokens Expo reports as no longer registered', async () => {
    const { user, project, token: t } = await setup('Asia/Kolkata');
    await createTask(user, project.id, { name: 'Ping', dueDate: tomorrow });

    const send = fakeSender((messages) =>
      messages.map((m) =>
        m.to === t
          ? { status: 'error' as const, message: 'gone', details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok' as const, id: 'x' },
      ),
    );
    await runDueTomorrowReminders({ now, send, hour: 18 });
    expect(await prisma.pushToken.count({ where: { token: t } })).toBe(0);
  });

  it('is exposed for an external cron behind a shared secret', async () => {
    await api().post('/api/jobs/due-reminders').expect(401);
    await api().post('/api/jobs/due-reminders').set('x-cron-secret', 'wrong-secret-wrong-secret').expect(401);
    // Pushing for real would hit Expo's servers, so this checks auth and the response shape only.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const res = await api().post('/api/jobs/due-reminders').set('x-cron-secret', process.env.CRON_SECRET!).expect(200);
    expect(res.body).toEqual(expect.objectContaining({ checked: expect.any(Number), notified: expect.any(Number) }));
    vi.restoreAllMocks();
  });
});
