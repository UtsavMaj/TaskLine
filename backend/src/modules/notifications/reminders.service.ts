import type { RegisterPushTokenData } from '@taskline/shared';

import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { fromDateOnly, toDateOnly } from '../../lib/serializers';
import { expoPushSender, type PushMessage, type PushSender } from './expo-push';

/** Reminders go out between REMINDER_HOUR and this hour (local time), so a late cron run still counts. */
const LAST_SEND_HOUR = 22;
const ANDROID_CHANNEL = 'due-reminders';

// ---- device registration ---------------------------------------------------

/**
 * Stores (or moves) a device token. A token is unique per installed app, so if another
 * account signs in on the same phone, the token simply switches owner.
 */
export async function registerPushToken(userId: string, sessionId: string, data: RegisterPushTokenData) {
  const existing = await prisma.pushToken.findUnique({ where: { token: data.token }, select: { userId: true } });
  const changedOwner = existing !== null && existing.userId !== userId;

  await prisma.pushToken.upsert({
    where: { token: data.token },
    create: { token: data.token, userId, sessionId, timezone: data.timezone },
    update: {
      userId,
      sessionId,
      timezone: data.timezone,
      // A token that changed hands must not inherit the previous user's "already notified" flag.
      ...(changedOwner ? { lastNotifiedOn: null } : {}),
    },
  });
}

export async function removePushToken(userId: string, token: string) {
  await prisma.pushToken.deleteMany({ where: { token, userId } });
}

// ---- the daily job ---------------------------------------------------------

/** Local calendar date and hour of `now` in the given IANA zone. */
export function localDateAndHour(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface ReminderRunResult {
  checked: number;
  notified: number;
  removedTokens: number;
}

/**
 * Sends one push per device, in the evening (device local time), listing the user's open tasks
 * due the next day. Safe to run as often as you like: each device is "claimed" for the day with
 * a conditional update before sending, so overlapping runs never double-notify.
 */
export async function runDueTomorrowReminders(
  options: { now?: Date; send?: PushSender; hour?: number } = {},
): Promise<ReminderRunResult> {
  const now = options.now ?? new Date();
  const send = options.send ?? expoPushSender;
  const fromHour = options.hour ?? env.REMINDER_HOUR;

  // Only phones whose sign-in is still valid: a revoked or expired session gets no reminders.
  const tokens = await prisma.pushToken.findMany({
    where: { session: { revokedAt: null, expiresAt: { gt: now } } },
    select: { id: true, token: true, userId: true, timezone: true, lastNotifiedOn: true },
  });

  const messages: PushMessage[] = [];
  const messageTokenIds: string[] = [];
  const tasksCache = new Map<string, { name: string }[]>();

  for (const device of tokens) {
    const { date: today, hour } = localDateAndHour(now, device.timezone);
    if (hour < fromHour || hour >= LAST_SEND_HOUR) continue;
    if (toDateOnly(device.lastNotifiedOn) === today) continue;

    // Claim this device for today; if another run got here first, count is 0 and we skip it.
    const claim = await prisma.pushToken.updateMany({
      where: {
        id: device.id,
        OR: [{ lastNotifiedOn: null }, { lastNotifiedOn: { not: fromDateOnly(today)! } }],
      },
      data: { lastNotifiedOn: fromDateOnly(today) },
    });
    if (claim.count === 0) continue;

    const tomorrow = addDays(today, 1);
    const cacheKey = `${device.userId}:${tomorrow}`;
    let tasks = tasksCache.get(cacheKey);
    if (!tasks) {
      tasks = await prisma.task.findMany({
        where: { project: { userId: device.userId }, dueDate: fromDateOnly(tomorrow), status: { not: 'COMPLETED' } },
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
        select: { name: true },
      });
      tasksCache.set(cacheKey, tasks);
    }
    if (tasks.length === 0) continue;

    const names = tasks.slice(0, 3).map((task) => task.name);
    const more = tasks.length > 3 ? ` and ${tasks.length - 3} more` : '';
    messages.push({
      to: device.token,
      title: tasks.length === 1 ? '1 task is due tomorrow' : `${tasks.length} tasks are due tomorrow`,
      body: `${names.join(', ')}${more}`,
      data: { url: '/tasks' },
      sound: 'default',
      channelId: ANDROID_CHANNEL,
    });
    messageTokenIds.push(device.id);
  }

  let removedTokens = 0;
  if (messages.length > 0) {
    const tickets = await send(messages);
    const dead: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        // The app was uninstalled or notifications were revoked: forget the token.
        if (ticket.details?.error === 'DeviceNotRegistered') dead.push(messageTokenIds[i]!);
        else logger.warn({ message: ticket.message }, 'Push ticket error');
      }
    });
    if (dead.length) removedTokens = (await prisma.pushToken.deleteMany({ where: { id: { in: dead } } })).count;
  }

  const result = { checked: tokens.length, notified: messages.length - removedTokens, removedTokens };
  if (messages.length) logger.info(result, 'Due-tomorrow reminders sent');
  return result;
}

/** In-process scheduler for always-on hosts. Returns a stop function. */
export function startReminderScheduler(intervalMs = 15 * 60 * 1000) {
  const tick = () => runDueTomorrowReminders().catch((error) => logger.error({ err: error }, 'Reminder job failed'));
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
