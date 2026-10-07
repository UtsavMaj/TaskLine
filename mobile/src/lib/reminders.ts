import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayLocal } from '@taskline/shared';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { api } from './api';

/**
 * "Due tomorrow" reminders, two ways:
 *
 *  - push (preferred): the phone registers its Expo push token with the API, and the backend
 *    sends a push at 6 pm local time listing the open tasks due tomorrow. Works even if the
 *    app hasn't been opened for days, and reflects changes made on the web.
 *  - local (fallback): if a push token can't be obtained (no EAS project id configured yet),
 *    the phone schedules the same notification itself from the data it last loaded.
 *
 * Expo Go on Android dropped expo-notifications in SDK 53 and the module throws as soon as it is
 * imported there, so it's loaded lazily and only in a real build (APK / development build).
 */

type NotificationsModule = typeof import('expo-notifications');
type Mode = 'push' | 'local';

const KEYS = { enabled: 'taskline.reminders-enabled', mode: 'taskline.reminders-mode', token: 'taskline.push-token' };
const LOCAL_NOTIFICATION_ID = 'taskline-due-tomorrow';
const CHANNEL_ID = 'due-reminders';
const REMIND_AT_HOUR = 18;

/** False on web and inside Expo Go; true in the installed APK. */
export const remindersSupported = Platform.OS !== 'web' && !isRunningInExpoGo();

let notificationsModule: NotificationsModule | null = null;

function loadNotifications(): NotificationsModule | null {
  if (!remindersSupported) return null;
  if (!notificationsModule) {
    notificationsModule = require('expo-notifications') as NotificationsModule;
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }
  return notificationsModule;
}

function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function remindersEnabled() {
  return remindersSupported && (await AsyncStorage.getItem(KEYS.enabled)) === 'true';
}

export async function reminderMode(): Promise<Mode | null> {
  return (await AsyncStorage.getItem(KEYS.mode)) as Mode | null;
}

async function ensureChannel(Notifications: NotificationsModule) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Due date reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Gets this phone's Expo push token and hands it to the API. Returns false if push isn't available. */
async function registerForPush(Notifications: NotificationsModule): Promise<boolean> {
  const projectId = easProjectId();
  if (!projectId) return false;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.registerPushToken(token, deviceTimeZone());
    await AsyncStorage.setItem(KEYS.token, token);
    return true;
  } catch {
    return false;
  }
}

/** Asks for permission when turning on. Returns the resulting state. */
export async function setRemindersEnabled(enabled: boolean): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) return false;

  if (!enabled) {
    const token = await AsyncStorage.getItem(KEYS.token);
    if (token) await api.removePushToken(token).catch(() => undefined);
    await cancelLocalReminder(Notifications);
    await AsyncStorage.multiRemove([KEYS.enabled, KEYS.mode, KEYS.token]);
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;

  await ensureChannel(Notifications);
  const mode: Mode = (await registerForPush(Notifications)) ? 'push' : 'local';
  await AsyncStorage.multiSet([
    [KEYS.enabled, 'true'],
    [KEYS.mode, mode],
  ]);
  await syncReminders();
  return true;
}

async function cancelLocalReminder(Notifications: NotificationsModule) {
  await Notifications.cancelScheduledNotificationAsync(LOCAL_NOTIFICATION_ID).catch(() => undefined);
}

/** Called on sign-out: the server drops the token with the session, the phone forgets the rest. */
export async function resetReminders() {
  const Notifications = loadNotifications();
  if (Notifications) await cancelLocalReminder(Notifications);
  await AsyncStorage.multiRemove([KEYS.enabled, KEYS.mode, KEYS.token]).catch(() => undefined);
}

function nextReminderTime(now = new Date()) {
  const at = new Date(now);
  at.setHours(REMIND_AT_HOUR, 0, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 1);
  return at;
}

/**
 * Keeps reminders in step with the data. In push mode it re-registers the token (cheap upsert,
 * also picks up a new time zone); in local mode it rebuilds the scheduled notification.
 * Safe to call often; never throws.
 */
export async function syncReminders() {
  try {
    const Notifications = loadNotifications();
    if (!Notifications || !(await remindersEnabled())) return;

    if ((await reminderMode()) === 'push') {
      if (await registerForPush(Notifications)) return;
      await AsyncStorage.setItem(KEYS.mode, 'local'); // push stopped working: fall back
    }

    await cancelLocalReminder(Notifications);
    const remindAt = nextReminderTime();
    const dueDay = new Date(remindAt);
    dueDay.setDate(dueDay.getDate() + 1);

    const { data } = await api.tasks({ dueOn: todayLocal(dueDay), limit: 50, sortBy: 'priority', order: 'desc' });
    const open = data.filter((task) => task.status !== 'COMPLETED');
    if (open.length === 0) return;

    const names = open.slice(0, 3).map((task) => task.name);
    const more = open.length > 3 ? ` and ${open.length - 3} more` : '';

    await Notifications.scheduleNotificationAsync({
      identifier: LOCAL_NOTIFICATION_ID,
      content: {
        title: open.length === 1 ? '1 task is due tomorrow' : `${open.length} tasks are due tomorrow`,
        body: `${names.join(', ')}${more}`,
        data: { url: '/tasks' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: remindAt,
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    // Reminders are a nice-to-have; a failure here must never break the app.
  }
}

/** Opens the tasks list when the user taps a reminder. Returns an unsubscribe function. */
export function onReminderTapped(open: (url: string) => void) {
  const Notifications = loadNotifications();
  if (!Notifications) return () => undefined;
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
  });
  return () => sub.remove();
}
