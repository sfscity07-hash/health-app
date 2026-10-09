import { create } from 'zustand';

import { DEFAULT_REMINDERS, type ReminderKey, type ReminderSetting, type ReminderSettings } from '@/features/reminders/logic';

/** Reminders belong to this phone, so they're kept on it (localStorage), not in your account. */
const KEY = 'fuel.reminders';

function load(): ReminderSettings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULT_REMINDERS;
    const saved = JSON.parse(raw) as Partial<ReminderSettings>;
    return {
      weighIn: { ...DEFAULT_REMINDERS.weighIn, ...saved.weighIn },
      lunch: { ...DEFAULT_REMINDERS.lunch, ...saved.lunch },
      finish: { ...DEFAULT_REMINDERS.finish, ...saved.finish },
      checkin: { ...DEFAULT_REMINDERS.checkin, ...saved.checkin },
    };
  } catch {
    return DEFAULT_REMINDERS;
  }
}

type RemindersState = {
  settings: ReminderSettings;
  update: (key: ReminderKey, patch: Partial<ReminderSetting>) => void;
};

export const useReminderSettings = create<RemindersState>((set, get) => ({
  settings: load(),
  update: (key, patch) => {
    const settings = { ...get().settings, [key]: { ...get().settings[key], ...patch } };
    set({ settings });
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(settings));
    } catch {
      // Kept for this session at least.
    }
  },
}));
