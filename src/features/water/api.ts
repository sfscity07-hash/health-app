import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { patchSummaries } from '@/features/dashboard/api';
import { reportFailure } from '@/lib/failure';
import { requireSupabase } from '@/lib/supabase';

export type Drink = { id: string; amount_ml: number; logged_at: string };

export const waterKeys = { day: (date: string) => ['waterLogs', date] as const };

/** Each drink on a day, in the order you had them. */
export function useWaterLogs(date: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: waterKeys.day(date),
    enabled: Boolean(session && date),
    queryFn: async (): Promise<Drink[]> => {
      const { data, error } = await requireSupabase()
        .from('water_logs')
        .select('id, amount_ml, logged_at')
        .eq('log_date', date)
        .order('logged_at');
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id as string, amount_ml: Number(r.amount_ml), logged_at: r.logged_at as string }));
    },
  });
}

function settle(queryClient: ReturnType<typeof useQueryClient>, date: string) {
  queryClient.invalidateQueries({ queryKey: ['summaries'] });
  queryClient.invalidateQueries({ queryKey: waterKeys.day(date) });
}

/** Adds a drink. The day's total and list update straight away. */
export function useAddWater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, ml }: { date: string; ml: number }) => {
      const { error } = await requireSupabase().from('water_logs').insert({ log_date: date, amount_ml: ml });
      if (error) throw error;
    },
    onMutate: ({ date, ml }) => {
      patchSummaries(queryClient, date, (d) => ({ ...d, water_ml: d.water_ml + ml }));
      queryClient.setQueryData<Drink[]>(waterKeys.day(date), (old) =>
        old ? [...old, { id: `temp-${Date.now()}`, amount_ml: ml, logged_at: new Date().toISOString() }] : old,
      );
    },
    onError: (e) => reportFailure('add that water', e),
    onSettled: (_d, _e, v) => settle(queryClient, v.date),
  });
}

export function useDeleteWater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; date: string; ml: number }) => {
      const { error } = await requireSupabase().from('water_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: ({ id, date, ml }) => {
      patchSummaries(queryClient, date, (d) => ({ ...d, water_ml: Math.max(0, d.water_ml - ml) }));
      queryClient.setQueryData<Drink[]>(waterKeys.day(date), (old) => old?.filter((d) => d.id !== id));
    },
    onError: (e) => reportFailure('remove that drink', e),
    onSettled: (_d, _e, v) => settle(queryClient, v.date),
  });
}
