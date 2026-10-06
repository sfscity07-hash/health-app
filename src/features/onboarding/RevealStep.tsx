import { StyleSheet, View } from 'react-native';

import { CalorieGauge } from '@/components/CalorieGauge';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import type { OnboardingPlan } from '@/features/onboarding/draft';
import { formatShortDate } from '@/lib/dates';
import { formatInt } from '@/lib/format';
import { MIN_CALORIES, type MacroTargets } from '@/lib/nutrition';
import { displayRate, displayWeight } from '@/lib/units';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';
import type { UnitSystem } from '@/types/profile';

export const CALORIE_STEP = 50;
export const CALORIE_RANGE = { min: 1000, max: 5000 };

type RevealStepProps = {
  plan: OnboardingPlan;
  units: UnitSystem;
  calories: number;
  macros: MacroTargets;
  onChangeCalories: (calories: number) => void;
};

export function RevealStep({ plan, units, calories, macros, onChangeCalories }: RevealStepProps) {
  const { colors } = useTheme();
  const suggested = plan.target.calories;
  const adjust = (by: number) =>
    onChangeCalories(Math.min(CALORIE_RANGE.max, Math.max(CALORIE_RANGE.min, calories + by)));

  const macroRows = [
    { label: 'Protein', grams: macros.protein_g, color: colors.protein },
    { label: 'Carbs', grams: macros.carbs_g, color: colors.carbs },
    { label: 'Fat', grams: macros.fat_g, color: colors.fat },
  ];

  const maintenance = formatInt(plan.target.maintenance);
  const deltaText = formatInt(Math.abs(plan.target.delta));
  const why =
    plan.goal === 'maintain'
      ? `About ${maintenance} kcal a day keeps your weight steady.`
      : plan.goal === 'recomp'
        ? `About ${maintenance} kcal keeps you steady. Eating ${deltaText} less a day, with plenty of protein, lets you lose fat while you build muscle. Expect the scale to move slowly; your waist and lifts are the better guide.`
        : `About ${maintenance} kcal keeps you steady. ${plan.goal === 'lose' ? 'Eating' : 'Adding'} ${deltaText} ${
            plan.goal === 'lose' ? 'less' : 'more'
          } a day moves you about ${displayRate(plan.kgPerWeek, units)} a week.`;

  return (
    <View style={styles.root}>
      <View style={styles.gaugeWrap}>
        <CalorieGauge fraction={1} size={248}>
          <AnimatedNumber value={calories} variant="display" />
          <Text variant="caption">kcal a day</Text>
        </CalorieGauge>
        <View style={styles.adjust}>
          <IconButton icon="minus" label={`Lower by ${CALORIE_STEP} kcal`} onPress={() => adjust(-CALORIE_STEP)} />
          <Text variant="caption">Adjust by {CALORIE_STEP}</Text>
          <IconButton icon="plus" label={`Raise by ${CALORIE_STEP} kcal`} onPress={() => adjust(CALORIE_STEP)} />
        </View>
        {calories !== suggested ? (
          <Button label={`Reset to suggested ${formatInt(suggested)}`} variant="ghost" onPress={() => onChangeCalories(suggested)} />
        ) : null}
      </View>

      <Card style={styles.macros}>
        {macroRows.map((m, i) => (
          <View key={m.label} style={[styles.macro, i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.hairline }]}>
            <View style={styles.macroLabel}>
              <View style={[styles.dot, { backgroundColor: m.color }]} />
              <Text variant="caption">{m.label}</Text>
            </View>
            <AnimatedNumber value={m.grams} variant="heading" format={(n) => `${Math.round(n)} g`} />
          </View>
        ))}
      </Card>

      <View style={styles.notes}>
        <Text variant="small" color="textSecondary">
          {why}
        </Text>
        {plan.goalDate && plan.goalWeightKg !== null ? (
          <Text variant="small" color="textSecondary">
            You’d reach {displayWeight(plan.goalWeightKg, units)} around{' '}
            <Text variant="smallStrong">{formatShortDate(plan.goalDate)}</Text>.
          </Text>
        ) : null}
        {plan.goal === 'recomp' ? (
          <Text variant="small" color="textSecondary">
            Recomp works when you lift weights at least three times a week.
          </Text>
        ) : null}
        {plan.target.raisedToMinimum ? (
          <Text variant="small" color="warn">
            We kept your budget at the {formatInt(MIN_CALORIES[plan.sex])} kcal minimum, so progress will be a little slower
            than the pace you picked.
          </Text>
        ) : null}
        <Text variant="small" color="textSecondary">
          Every Monday, Fuel checks your real weight trend and suggests updates to this number.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xl },
  gaugeWrap: { alignItems: 'center', gap: space.xs },
  adjust: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  macros: { flexDirection: 'row', paddingVertical: space.lg },
  macro: { flex: 1, paddingHorizontal: space.lg, gap: space.xs },
  macroLabel: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  dot: { width: 6, height: 6, borderRadius: 2 },
  notes: { gap: space.sm },
});
