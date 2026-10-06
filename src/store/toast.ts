import { create } from 'zustand';

export type ToastTone = 'good' | 'warn' | 'info';

type ToastState = {
  id: number;
  message: string | null;
  tone: ToastTone;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
};

/** One short confirmation at a time, e.g. "Added Salmon · 309 kcal". */
export const useToast = create<ToastState>((set) => ({
  id: 0,
  message: null,
  tone: 'good',
  show: (message, tone = 'good') => set((s) => ({ id: s.id + 1, message, tone })),
  hide: () => set({ message: null }),
}));
