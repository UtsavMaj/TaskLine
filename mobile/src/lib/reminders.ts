import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayLocal } from '@taskline/shared';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

import { api } from './api';

/**
 * "Due tomorrow" reminders.
 * At 6 pm the evening before, the phone shows a local notification listing the open tasks due
 * the next day. The schedule is rebuilt whenever the app comes to the foreground or a task
 * changes, so it always reflects the latest data from the API.
 *
 * Expo Go on Android dropped expo-notifications in SDK 53 and the module throws as soon as it is
 * imported there. So it is loaded lazily, and only in the real app build (the APK / dev build).
 */

type NotificationsModule = typeof import('expo-notifications');

const PREF_KEY = 'taskline.reminders-enabled';
const NOTIFICATION_ID = 'taskline-due-tomorrow';
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

export async function remindersEnabled() {
  return remindersSupported && (await AsyncStorage.getItem(PREF_KEY)) === 'true';
}

/** Asks for permission when turning on. Returns the resulting state. */
export async function setRemindersEnabled(enabled: boolean): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) return false;
  if (enabled) {
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) {
      await AsyncStorage.setItem(PREF_KEY, 'false');
      return false;
    }
  }
  await AsyncStorage.setItem(PREF_KEY, String(enabled));
  await syncReminders();
  return enabled;
}

export async function cancelReminders() {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => undefined);
}

function nextReminderTime(now = new Date()) {
  const at = new Date(now);
  at.setHours(REMIND_AT_HOUR, 0, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 1);
  return at;
}

/** Rebuilds the scheduled notification from the API. Safe to call often; never throws. */
export async function syncReminders() {
  try {
    const Notifications = loadNotifications();
    if (!Notifications) return;

    await cancelReminders();
    if (!(await remindersEnabled())) return;

    const remindAt = nextReminderTime();
    const dueDay = new Date(remindAt);
    dueDay.setDate(dueDay.getDate() + 1);

    const { data } = await api.tasks({ dueOn: todayLocal(dueDay), limit: 50, sortBy: 'priority', order: 'desc' });
    const open = data.filter((task) => task.status !== 'COMPLETED');
    if (open.length === 0) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Due date reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const names = open.slice(0, 3).map((task) => task.name);
    const more = open.length > 3 ? ` and ${open.length - 3} more` : '';

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: open.length === 1 ? '1 task is due tomorrow' : `${open.length} tasks are due tomorrow`,
        body: `${names.join(', ')}${more}`,
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
