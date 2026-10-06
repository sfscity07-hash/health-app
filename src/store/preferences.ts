import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

type PreferencesState = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

/**
 * Device-level UI preferences. Synced to the `profiles` row once accounts
 * land in Phase 2; kept in memory until then.
 */
export const usePreferences = create<PreferencesState>((set) => ({
  theme: 'system',
  setTheme: (theme) => set({ theme }),
}));
