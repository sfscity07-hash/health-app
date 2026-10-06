import { StyleSheet, View } from 'react-native';

import { OptionCard } from '@/components/ui/OptionCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { goalWeightKgOf, hasPace, weightKgOf, type OnboardingDraft } from '@/features/onboarding/draft';
import { formatShortDate } from '@/lib/dates';
import { formatInt } from '@/lib/format';
import { ACTIVITY_LEVELS, dailyDelta, PACE_OPTIONS, projectedGoalDate } from '@/lib/nutrition';
import { displayRate, displayWeight } from '@/lib/units';
import type { ActivityLevel, Goal, Sex, UnitSystem } from '@/types/profile';
import { space } from '@/theme/tokens';

export type StepProps = {
  draft: OnboardingDraft;
  set: <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;
  setUnits: (units: UnitSystem) => void;
  /** Moves on after a single-choice answer, so those steps need no Continue tap. */
  autoAdvance: (patch: Partial<OnboardingDraft>) => void;
};

const GOALS: { value: Goal; title: string; description: string; icon: 'trendDown' | 'recomp' | 'target' | 'bolt' }[] = [
  { value: 'lose', title: 'Lose weight', description: 'Steady fat loss while keeping muscle', icon: 'trendDown' },
  { value: 'recomp', title: 'Recomp', description: 'Lose fat and build muscle at the same time', icon: 'recomp' },
  { value: 'maintain', title: 'Maintain', description: 'Hold your weight and eat with structure', icon: 'target' },
  { value: 'gain', title: 'Build muscle', description: 'A small surplus for lean gains', icon: 'bolt' },
];

export function GoalStep({ draft, set, autoAdvance }: StepProps) {
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {GOALS.map((g) => (
        <OptionCard
          key={g.value}
          icon={g.icon}
          title={g.title}
          description={g.description}
          selected={draft.goal === g.value}
          onPress={() => {
            set('goal', g.value);
            if (!hasPace(g.value)) set('kgPerWeek', null);
            autoAdvance({ goal: g.value });
          }}
        />
      ))}
    </View>
  );
}

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

export function AboutStep({ draft, set }: StepProps) {
  return (
    <View style={styles.fields}>
      <View style={styles.group}>
        <Text variant="caption" color="textSecondary">
          Sex used for the metabolism formula
        </Text>
        <SegmentedControl label="Sex" options={SEX_OPTIONS} value={draft.sex} onChange={(v) => set('sex', v)} />
      </View>
      <TextField
        label="Age"
        value={draft.age}
        onChangeText={(v) => set('age', v)}
        keyboardType="number-pad"
        placeholder="30"
        suffix="years"
        maxLength={2}
        returnKeyType="done"
      />
    </View>
  );
}

const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'kg · cm' },
  { value: 'imperial', label: 'lb · ft' },
];

export function BodyStep({ draft, set, setUnits }: StepProps) {
  const imperial = draft.units === 'imperial';
  return (
    <View style={styles.fields}>
      <SegmentedControl label="Units" options={UNIT_OPTIONS} value={draft.units} onChange={setUnits} />
      {imperial ? (
        <View style={styles.row}>
          <TextField
            flex
            label="Height"
            value={draft.heightFt}
            onChangeText={(v) => set('heightFt', v)}
            keyboardType="number-pad"
            placeholder="5"
            suffix="ft"
            maxLength={1}
          />
          <TextField
            flex
            label=" "
            accessibilityLabel="Height, inches"
            value={draft.heightIn}
            onChangeText={(v) => set('heightIn', v)}
            keyboardType="number-pad"
            placeholder="10"
            suffix="in"
            maxLength={2}
          />
        </View>
      ) : (
        <TextField
          label="Height"
          value={draft.heightCm}
          onChangeText={(v) => set('heightCm', v)}
          keyboardType="decimal-pad"
          placeholder="178"
          suffix="cm"
          maxLength={5}
        />
      )}
      <TextField
        label="Current weight"
        value={draft.weight}
        onChangeText={(v) => set('weight', v)}
        keyboardType="decimal-pad"
        placeholder={imperial ? '180' : '82.5'}
        suffix={imperial ? 'lb' : 'kg'}
        maxLength={5}
      />
    </View>
  );
}

export function ActivityStep({ draft, set, autoAdvance }: StepProps) {
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((level) => (
        <OptionCard
          key={level}
          title={ACTIVITY_LEVELS[level].label}
          description={ACTIVITY_LEVELS[level].description}
          selected={draft.activity === level}
          onPress={() => {
            set('activity', level);
            autoAdvance({ activity: level });
          }}
        />
      ))}
    </View>
  );
}

export function TargetStep({ draft, set }: StepProps) {
  const goal = draft.goal === 'gain' ? 'gain' : 'lose';
  const current = weightKgOf(draft);
  const target = goalWeightKgOf(draft);
  const date =
    current !== null && target !== null && draft.kgPerWeek && (goal === 'lose' ? target < current : target > current)
      ? projectedGoalDate(new Date(), current, target, draft.kgPerWeek)
      : null;
  return (
    <View style={styles.fields}>
      <TextField
        label="Goal weight"
        value={draft.goalWeight}
        onChangeText={(v) => set('goalWeight', v)}
        keyboardType="decimal-pad"
        placeholder={draft.units === 'imperial' ? '165' : '75'}
        suffix={draft.units === 'imperial' ? 'lb' : 'kg'}
        maxLength={5}
      />
      <View style={styles.group}>
        <Text variant="caption" color="textSecondary">
          Pace per week
        </Text>
        <View style={styles.list} accessibilityRole="radiogroup">
          {PACE_OPTIONS[goal].map((p) => {
            const delta = Math.round(dailyDelta(goal, p.kgPerWeek));
            return (
              <OptionCard
                key={p.kgPerWeek}
                title={`${p.label} · ${displayRate(p.kgPerWeek, draft.units)}`}
                description={`${delta > 0 ? '+' : '−'}${formatInt(Math.abs(delta))} kcal a day${p.note ? ` · ${p.note}` : ''}`}
                selected={draft.kgPerWeek === p.kgPerWeek}
                onPress={() => set('kgPerWeek', p.kgPerWeek)}
              />
            );
          })}
        </View>
      </View>
      {date && target !== null ? (
        <Text variant="small" color="textSecondary">
          At this pace you’d reach {displayWeight(target, draft.units)} around{' '}
          <Text variant="smallStrong">{formatShortDate(date)}</Text>.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  fields: { gap: space.xl },
  group: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
});
