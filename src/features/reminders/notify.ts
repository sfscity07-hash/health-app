import { Platform } from 'react-native';

import type { PlannedReminder } from '@/features/reminders/logic';

/**
 * Local notifications on the phone (no server, free). expo-notifications is
 * loaded only once you use reminders, so its Expo Go notice doesn't appear for
 * everyone. On the web there are no reminders.
 */
export const remindersSupported = Platform.OS !== 'web';

type Notifications = typeof import('expo-notifications');
let loaded: Promise<Notifications> | null = null;
const CHANNEL = 'reminders';

function load(): Promise<Notifications> {
  loaded ??= import('expo-notifications').then(async (N) => {
    N.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: N.AndroidImportance.DEFAULT });
    }
    return N;
  });
  return loaded;
}

/** Asks for permission if it hasn't been refused for good. True when reminders can be shown. */
export async function ensurePermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  const N = await load();
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await N.requestPermissionsAsync()).granted;
}

export async function hasPermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  const N = await load();
  return (await N.getPermissionsAsync()).granted;
}

/** Replaces everything scheduled with this plan. */
export async function schedule(plan: PlannedReminder[]) {
  const N = await load();
  await N.cancelAllScheduledNotificationsAsync();
  for (const r of plan) {
    await N.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, data: { url: r.url } },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
    });
  }
}

export async function cancelAll() {
  if (!remindersSupported) return;
  const N = await load();
  await N.cancelAllScheduledNotificationsAsync();
}

/** Calls back with the screen to open when a reminder is tapped. Returns a function that stops listening. */
export async function onReminderTap(open: (url: string) => void): Promise<() => void> {
  const N = await load();
  const sub = N.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
  });
  return () => sub.remove();
}
