import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import type { OnboardingPlan } from '@/features/onboarding/draft';
import { birthDateForAge, toISODate } from '@/lib/dates';
import { requireSupabase } from '@/lib/supabase';
import type { Profile, UnitSystem } from '@/types/profile';

export const profileKey = (userId: string | undefined) => ['profile', userId] as const;

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await requireSupabase().from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

/** The signed-in user's profile. Disabled while signed out. */
export function useProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: profileKey(userId),
    queryFn: () => fetchProfile(userId as string),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

export type OnboardingSave = {
  plan: OnboardingPlan;
  calories: number;
  macros: { protein_g: number; carbs_g: number; fat_g: number };
  units: UnitSystem;
  today: Date;
};

/** Writes the first weigh-in, then the profile. The profile write is what unlocks the app. */
export async function saveOnboarding(userId: string, s: OnboardingSave): Promise<Profile> {
  const sb = requireSupabase();
  const weigh = await sb
    .from('weight_logs')
    .upsert({ log_date: toISODate(s.today), weight_kg: round(s.plan.weightKg, 2) }, { onConflict: 'user_id,log_date' });
  if (weigh.error) throw weigh.error;

  const { data, error } = await sb
    .from('profiles')
    .update({
      sex: s.plan.sex,
      birth_date: toISODate(birthDateForAge(s.plan.age, s.today)),
      height_cm: round(s.plan.heightCm, 1),
      activity_level: s.plan.activity,
      goal: s.plan.goal,
      goal_rate_kg_week: s.plan.kgPerWeek,
      goal_weight_kg: s.plan.goalWeightKg === null ? null : round(s.plan.goalWeightKg, 1),
      calorie_target: s.calories,
      protein_g: s.macros.protein_g,
      carbs_g: s.macros.carbs_g,
      fat_g: s.macros.fat_g,
      units: s.units,
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}

export function useSaveOnboarding() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: (s: OnboardingSave) => saveOnboarding(userId as string, s),
    onSuccess: (profile) => queryClient.setQueryData(profileKey(userId), profile),
  });
}

/** Small profile edits (theme now; goals and units in Phase 12). Updates the cache optimistically. */
export function useUpdateProfile() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Profile, 'theme' | 'units'>>) => {
      const { error } = await requireSupabase().from('profiles').update(patch).eq('id', userId as string);
      if (error) throw error;
    },
    onMutate: (patch) => {
      queryClient.setQueryData<Profile | null>(profileKey(userId), (old) => (old ? { ...old, ...patch } : old));
    },
  });
}
