/** Mirrors the enums and `profiles` table in supabase/migrations. */
export type Sex = 'female' | 'male';
export type Goal = 'lose' | 'recomp' | 'maintain' | 'gain';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type UnitSystem = 'metric' | 'imperial';
export type ThemeSetting = 'system' | 'light' | 'dark';

export type Profile = {
  id: string;
  display_name: string | null;
  sex: Sex | null;
  birth_date: string | null;
  height_cm: number | null;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
  goal_rate_kg_week: number | null;
  goal_weight_kg: number | null;
  calorie_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  water_goal_ml: number;
  units: UnitSystem;
  theme: ThemeSetting;
  exercise_addback: boolean;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};
