import { create } from 'zustand';

import { toISODate } from '@/lib/dates';

type DayState = {
  /** A day picked on the dashboard or Food log (YYYY-MM-DD), or null to follow today. */
  picked: string | null;
  setDate: (date: string) => void;
};

export const useDay = create<DayState>((set) => ({
  picked: null,
  // Picking today goes back to following today, so the app rolls over at midnight.
  setDate: (date) => set({ picked: date === toISODate(new Date()) ? null : date }),
}));

export const viewedDate = (picked: string | null) => picked ?? toISODate(new Date());

/** The day being viewed on the dashboard and Food log. New logs go here. */
export function useViewedDate() {
  return viewedDate(useDay((s) => s.picked));
}
