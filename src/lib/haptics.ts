import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS !== 'web';

/** Light tick for selections: tab changes, ruler steps, toggles. */
export function tick() {
  if (enabled) Haptics.selectionAsync().catch(() => {});
}

/** Firmer tap for primary actions such as logging a food. */
export function tap() {
  if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Celebration: finishing a day, hitting a goal, accepting a check-in. */
export function success() {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
