import { create } from 'zustand';

import { emptyDraft, type RecipeDraft, type RecipeItem } from '@/features/recipes/logic';
import type { ExternalFood } from '@/features/search/types';

/**
 * The recipe you're building or editing. It lives here (not in one screen) so
 * picking an ingredient on another screen adds straight to it.
 */
type DraftState = {
  draft: RecipeDraft;
  /** Which recipe the draft was loaded for, so reopening the editor doesn't reload over your changes. */
  loadedFor: string | null;
  start: (draft: RecipeDraft, loadedFor: string | null) => void;
  patch: (p: Partial<RecipeDraft>) => void;
  addItem: (item: RecipeItem) => void;
  replaceItem: (key: string, item: RecipeItem) => void;
  removeItem: (key: string) => void;
};

export const useRecipeDraft = create<DraftState>((set) => ({
  draft: emptyDraft(),
  loadedFor: null,
  start: (draft, loadedFor) => set({ draft, loadedFor }),
  patch: (p) => set((s) => ({ draft: { ...s.draft, ...p } })),
  addItem: (item) => set((s) => ({ draft: { ...s.draft, items: [...s.draft.items, item] } })),
  replaceItem: (key, item) => set((s) => ({ draft: { ...s.draft, items: s.draft.items.map((i) => (i.key === key ? { ...item, key } : i)) } })),
  removeItem: (key) => set((s) => ({ draft: { ...s.draft, items: s.draft.items.filter((i) => i.key !== key) } })),
}));

/** A food scanned (or created from a scan) for the recipe, on its way back to the ingredient picker. */
export type ScannedIngredient = { kind: 'saved'; id: string } | { kind: 'external'; food: ExternalFood };

export const useScannedIngredient = create<{ scanned: ScannedIngredient | null; put: (s: ScannedIngredient) => void; clear: () => void }>((set) => ({
  scanned: null,
  put: (scanned) => set({ scanned }),
  clear: () => set({ scanned: null }),
}));
