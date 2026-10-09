import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { EditorFooter } from '@/components/food/EditorFooter';
import { EditorStatus } from '@/components/food/EditorStatus';
import { ModalHeader } from '@/components/food/ModalHeader';
import { Button } from '@/components/ui/Button';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { useExpenditure } from '@/features/checkin/api';
import { fits, goalWeightProblem, KCAL_PER_G, macrosFor, percentOf, stepMacro } from '@/features/goals/logic';
import { useProfile, useUpdateProfile } from '@/features/profile/api';
import { toDisplay, unitLabel } from '@/features/weight/logic';
import { suggestBudget } from '@/lib/expenditure';
import { formatInt } from '@/lib/format';
import { success, tick } from '@/lib/haptics';
import { ACTIVITY_LEVELS, macroTargets, MIN_CALORIES, PACE_OPTIONS } from '@/lib/nutrition';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { gutter, radius, space } from '@/theme/tokens';
import type { ActivityLevel, Goal, Profile, UnitSystem } from '@/types/profile';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'lose', label: 'Lose' },
  { value: 'recomp', label: 'Recomp' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain' },
];
const UNITS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'kg, cm, ml' },
  { value: 'imperial', label: 'lb, ft, fl oz' },
];
const MODES: { value: 'grams' | 'percent'; label: string }[] = [
  { value: 'grams', label: 'Grams' },
  { value: 'percent', label: 'Percent' },
];
const MAX_KCAL = 6000;

function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <View style={styles.section}>
      <Text variant="label">{title}</Text>
      {children}
      {note ? (
        <Text variant="caption" color="textSecondary">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function GoalsForm({ profile }: { profile: Profile }) {
  const { colors } = useTheme();
  const update = useUpdateProfile();
  const showToast = useToast((s) => s.show);
  const exp = useExpenditure();
  const trendKg = exp.trendKg;

  const [goal, setGoal] = useState<Goal>(profile.goal ?? 'lose');
  const [goalKg, setGoalKg] = useState<number | null>(profile.goal_weight_kg ?? (trendKg !== null ? Math.round(trendKg) : null));
  const [pace, setPace] = useState<number>(profile.goal_rate_kg_week ?? 0.5);
  const [activity, setActivity] = useState<ActivityLevel>(profile.activity_level ?? 'moderate');
  const [kcal, setKcal] = useState(profile.calorie_target ?? 2000);
  const [proteinG, setProteinG] = useState(profile.protein_g ?? 150);
  const [fatG, setFatG] = useState(profile.fat_g ?? 65);
  const [mode, setMode] = useState<'grams' | 'percent'>('grams');
  const [units, setUnits] = useState<UnitSystem>(profile.units ?? 'metric');

  const unit = unitLabel(units);
  const floor = MIN_CALORIES[profile.sex ?? 'female'];
  const paceOptions = goal === 'gain' ? PACE_OPTIONS.gain : goal === 'lose' ? PACE_OPTIONS.lose : [];
  const kgPerWeek = paceOptions.some((p) => p.kgPerWeek === pace) ? pace : (paceOptions.find((p) => p.note === 'Recommended')?.kgPerWeek ?? 0);
  const suggested = Math.min(MAX_KCAL, suggestBudget({ expenditure: exp.result.kcal, goal, kgPerWeek, sex: profile.sex }));
  const macros = macrosFor(kcal, proteinG, fatG);
  const weightProblem = goal === 'maintain' || goal === 'recomp' ? null : goalWeightProblem(goal, trendKg, goalKg);
  const step = units === 'imperial' ? 0.45359237 : 0.5;

  const showKg = (kg: number) => `${toDisplay(kg, units).toFixed(units === 'imperial' ? 0 : 1)} ${unit}`;
  const showPace = (kg: number) => `${Number(toDisplay(kg, units).toFixed(2))} ${unit}/wk`;
  const macroValue = (grams: number, kcalPerG: number) => (mode === 'grams' ? `${grams} g` : `${percentOf(kcal, grams, kcalPerG)}%`);

  function setCalories(next: number) {
    tick();
    setKcal(Math.min(MAX_KCAL, Math.max(floor, Math.round(next / 10) * 10)));
  }

  function recommendedMacros() {
    tick();
    const m = macroTargets(kcal, trendKg ?? 75, goal);
    setProteinG(m.protein_g);
    setFatG(m.fat_g);
  }

  function save() {
    if (weightProblem) return;
    update.mutate({
      goal,
      goal_weight_kg: goal === 'maintain' ? profile.goal_weight_kg : goalKg !== null ? Math.round(goalKg * 10) / 10 : null,
      goal_rate_kg_week: paceOptions.length ? kgPerWeek : profile.goal_rate_kg_week,
      activity_level: activity,
      calorie_target: kcal,
      ...macros,
      units,
    });
    success();
    showToast(`Saved · ${formatInt(kcal)} kcal a day`);
    router.back();
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader title="Goals & targets" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Goal">
          <SegmentedControl label="Goal" options={GOALS} value={goal} onChange={setGoal} />
        </Section>

        {goal === 'lose' || goal === 'gain' ? (
          <>
            <Stepper
              label="Goal weight"
              value={goalKg !== null ? showKg(goalKg) : '–'}
              hint={trendKg !== null ? `Trend now ${showKg(trendKg)}` : undefined}
              onMinus={() => {
                tick();
                setGoalKg((g) => Math.max(30, (g ?? trendKg ?? 75) - step));
              }}
              onPlus={() => {
                tick();
                setGoalKg((g) => Math.min(300, (g ?? trendKg ?? 75) + step));
              }}
            />
            {weightProblem ? (
              <Text variant="small" color="warn">
                {weightProblem}
              </Text>
            ) : null}
            <Section title="Pace">
              <ChipGroup label="Pace">
                {paceOptions.map((p) => (
                  <Chip
                    key={p.kgPerWeek}
                    label={`${p.label} · ${showPace(p.kgPerWeek)}`}
                    selected={kgPerWeek === p.kgPerWeek}
                    onPress={() => setPace(p.kgPerWeek)}
                  />
                ))}
              </ChipGroup>
            </Section>
          </>
        ) : (
          <Text variant="small" color="textSecondary">
            {goal === 'recomp'
              ? 'Recomp eats about 10% under what you burn, with more protein, to lose fat and build muscle together.'
              : 'Maintain eats what you burn, so your trend stays steady.'}
          </Text>
        )}

        <Section title="Activity" note={ACTIVITY_LEVELS[activity].description + '. Used for the starting estimate; your check-ins learn the real number.'}>
          <ChipGroup label="Activity">
            {(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((a) => (
              <Chip key={a} label={ACTIVITY_LEVELS[a].label} selected={activity === a} onPress={() => setActivity(a)} />
            ))}
          </ChipGroup>
        </Section>

        <Section title="Daily calories">
          <Stepper
            label="Budget"
            value={`${formatInt(kcal)} kcal`}
            hint={`Suggested ${formatInt(suggested)} for this goal`}
            onMinus={() => setCalories(kcal - 50)}
            onPlus={() => setCalories(kcal + 50)}
            minDisabled={kcal <= floor}
            maxDisabled={kcal >= MAX_KCAL}
          />
          {kcal !== suggested ? <Button label={`Use suggested ${formatInt(suggested)} kcal`} variant="ghost" onPress={() => setCalories(suggested)} /> : null}
        </Section>

        <Section title="Macros" note="Carbs fill whatever calories protein and fat leave.">
          <SegmentedControl label="Set macros in" options={MODES} value={mode} onChange={setMode} />
          <View style={styles.split}>
            {(
              [
                [macros.protein_g * 4, colors.protein],
                [macros.carbs_g * 4, colors.carbs],
                [macros.fat_g * 9, colors.fat],
              ] as const
            ).map(([k, c], i) => (k > 0 ? <View key={i} style={{ flex: k, backgroundColor: c, borderRadius: 3 }} /> : null))}
          </View>
          <Stepper
            label="Protein"
            value={macroValue(macros.protein_g, KCAL_PER_G.protein)}
            onMinus={() => {
              tick();
              setProteinG(stepMacro(kcal, proteinG, KCAL_PER_G.protein, mode, -1));
            }}
            onPlus={() => {
              tick();
              const next = stepMacro(kcal, proteinG, KCAL_PER_G.protein, mode, 1);
              if (fits(kcal, next, fatG)) setProteinG(next);
            }}
            maxDisabled={!fits(kcal, stepMacro(kcal, proteinG, KCAL_PER_G.protein, mode, 1), fatG)}
          />
          <Stepper
            label="Fat"
            value={macroValue(macros.fat_g, KCAL_PER_G.fat)}
            onMinus={() => {
              tick();
              setFatG(stepMacro(kcal, fatG, KCAL_PER_G.fat, mode, -1));
            }}
            onPlus={() => {
              tick();
              const next = stepMacro(kcal, fatG, KCAL_PER_G.fat, mode, 1);
              if (fits(kcal, proteinG, next)) setFatG(next);
            }}
            maxDisabled={!fits(kcal, proteinG, stepMacro(kcal, fatG, KCAL_PER_G.fat, mode, 1))}
          />
          <View style={[styles.carbs, { backgroundColor: colors.surface1, borderColor: colors.hairline }]}>
            <Text variant="caption" color="textSecondary" style={styles.flex}>
              Carbs
            </Text>
            <Text variant="bodyStrong" tabular>
              {macroValue(macros.carbs_g, KCAL_PER_G.carbs)}
            </Text>
          </View>
          <Button label="Recommended for my goal" variant="ghost" onPress={recommendedMacros} />
        </Section>

        <Section title="Units">
          <SegmentedControl label="Units" options={UNITS} value={units} onChange={setUnits} />
        </Section>
      </ScrollView>
      <EditorFooter label="Save" trailing={`${formatInt(kcal)} kcal`} onPress={save} error={weightProblem} />
    </KeyboardAvoidingView>
  );
}

/** Change your goal, pace, activity, calorie budget, macros and units. */
export default function GoalsScreen() {
  const { data: profile } = useProfile();
  if (!profile) return <EditorStatus title="Goals & targets" onClose={() => router.back()} />;
  return <GoalsForm profile={profile} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxl, paddingTop: space.sm, gap: space.xl },
  section: { gap: space.sm },
  split: { flexDirection: 'row', height: 8, gap: 2, borderRadius: 4, overflow: 'hidden' },
  carbs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
