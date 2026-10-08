import { useMutation, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/dashboard/api';
import { reportFailure } from '@/lib/failure';
import { requireSupabase } from '@/lib/supabase';
import type { WeighIn } from '@/lib/trend';

/** Puts one day's weigh-in into the list (replacing that day's), kept oldest first. */
export function withWeighIn(list: WeighIn[], w: WeighIn): WeighIn[] {
  return [...list.filter((x) => x.date !== w.date), w].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Saves a weigh-in. One per day: saving a day again replaces it. The chart and dashboard update at once. */
export function useSaveWeighIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (w: WeighIn) => {
      const { error } = await requireSupabase()
        .from('weight_logs')
        .upsert({ log_date: w.date, weight_kg: Math.round(w.kg * 100) / 100 }, { onConflict: 'user_id,log_date' });
      if (error) throw error;
    },
    onMutate: (w) => queryClient.setQueryData<WeighIn[]>(keys.weighIns, (old) => withWeighIn(old ?? [], w)),
    onError: (e) => reportFailure('save your weigh-in', e),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.weighIns }),
  });
}

export function useDeleteWeighIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date }: { date: string }) => {
      const { error } = await requireSupabase().from('weight_logs').delete().eq('log_date', date);
      if (error) throw error;
    },
    onMutate: ({ date }) => queryClient.setQueryData<WeighIn[]>(keys.weighIns, (old) => old?.filter((w) => w.date !== date)),
    onError: (e) => reportFailure('delete that weigh-in', e),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.weighIns }),
  });
}
