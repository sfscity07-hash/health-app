import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExpenditureBars, type WeekBar } from '@/components/checkin/ExpenditureBars';
import { Confetti, type Burst } from '@/components/dashboard/Confetti';
import { TrendChart } from '@/components/progress/TrendChart';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import { useExpenditure, useSaveCheckin } from '@/features/checkin/api';
import { checkinWeek, consistencyText, paceText, reviewDates, reviewWeek, type Checkin } from '@/features/checkin/logic';
import { useWeighIns } from '@/features/dashboard/api';
import { useProfile } from '@/features/profile/api';
import { goodDirection, toDisplay, unitLabel } from '@/features/weight/logic';
import { addDays, formatShortDate, fromISODate, toISODate } from '@/lib/dates';
import { confidenceText, daysToGoal, suggestBudget, trendAt } from '@/lib/expenditure';
import { formatInt } from '@/lib/format';
import { success, tick } from '@/lib/haptics';
import { macroTargets, MIN_CALORIES } from '@/lib/nutrition';
import { trendSeries } from '@/lib/trend';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { gutter, radius, space } from '@/theme/tokens';

const STEPS = ['Consistency', 'Weight trend', 'Expenditure', 'Next week'] as const;
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const BUDGET_STEP = 50;
const MAX_BUDGET = 6000;

/** The weekly check-in: four short cards, then next week's budget. */
export default function CheckinScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToast((s) => s.show);
  const today = new Date();
  const week = checkinWeek(today);
  const dates = reviewDates(today);
  const { data: profile } = useProfile();
  const weighIns = useWeighIns();
  const exp = useExpenditure();
  const save = useSaveCheckin();
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [burst, setBurst] = useState<Burst | null>(null);
  const [done, setDone] = useState(false);
  const startRef = useRef<View>(null);

  if (!exp.ready || !profile) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.xxl }]}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading your week" />
      </View>
    );
  }

  const units = profile.units ?? 'metric';
  const unit = unitLabel(units);
  /** A body weight: "82.4 kg". */
  const weight = (kg: number) => `${toDisplay(kg, units).toFixed(1)} ${unit}`;
  /** A change or pace: "0.5 kg", "0.42 kg", "1.2 kg". */
  const amount = (kg: number) => `${Number(toDisplay(kg, units).toFixed(2))} ${unit}`;
  const goal = profile.goal ?? 'maintain';
  const oldTarget = profile.calorie_target ?? 2000;
  const r = exp.result;
  const review = reviewWeek(dates, exp.days, exp.previous);

  // The week's trend: from the day before the week to yesterday.
  const series = trendSeries(weighIns.data ?? []);
  const weekStartTrend = trendAt(series, toISODate(addDays(fromISODate(dates[0]), -1)));
  const weekEndTrend = trendAt(series, dates[6]);
  const weekChange = weekStartTrend !== null && weekEndTrend !== null ? weekEndTrend - weekStartTrend : null;
  const weekPoints = series.filter((p) => p.date >= toISODate(addDays(fromISODate(dates[0]), -1)) && p.date <= dates[6]);
  const weekWeighIns = (weighIns.data ?? []).filter((w) => w.date >= dates[0] && w.date <= dates[6]).length;
  const direction = goodDirection(goal);

  // Expenditure history: earlier check-ins, then this week's estimate.
  const earlier = exp.checkins.filter((c) => c.week_start < week && c.expenditure_kcal !== null).slice(-5);
  const bars: WeekBar[] = [...earlier.map((c) => ({ week: c.week_start, kcal: c.expenditure_kcal as number })), { week, kcal: r.kcal }];
  const lastWeek = earlier[earlier.length - 1]?.expenditure_kcal ?? null;

  const floor = MIN_CALORIES[profile.sex ?? 'female'];
  const suggested = Math.min(MAX_BUDGET, suggestBudget({ expenditure: r.kcal, goal, kgPerWeek: profile.goal_rate_kg_week ?? 0, sex: profile.sex }));
  const budget = chosen ?? suggested;
  const trendKg = exp.trendKg;
  const macros = trendKg !== null ? macroTargets(budget, trendKg, goal) : { protein_g: profile.protein_g ?? 0, carbs_g: profile.carbs_g ?? 0, fat_g: profile.fat_g ?? 0 };
  const goalKg = profile.goal_weight_kg;
  const daysNew = trendKg !== null && goalKg !== null ? daysToGoal({ trendKg, goalKg, expenditure: r.kcal, budget }) : null;
  const daysOld = trendKg !== null && goalKg !== null ? daysToGoal({ trendKg, goalKg, expenditure: r.kcal, budget: oldTarget }) : null;

  const next = () => {
    tick();
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => {
    tick();
    setStep((s) => Math.max(0, s - 1));
  };
  const adjust = (delta: number) => {
    tick();
    setChosen(Math.min(MAX_BUDGET, Math.max(floor, Math.round((budget + delta) / BUDGET_STEP) * BUDGET_STEP)));
  };

  function finish(keep: boolean) {
    if (done) return;
    const newTarget = keep ? oldTarget : budget;
    const checkin: Checkin = {
      week_start: week,
      days_logged: review.daysLogged,
      avg_intake_kcal: review.avgIntake,
      trend_change_kg: weekChange === null ? null : Math.round(weekChange * 100) / 100,
      expenditure_kcal: r.kcal,
      old_target: oldTarget,
      suggested_target: suggested,
      new_target: newTarget,
      decision: keep ? 'kept' : budget === suggested ? 'accepted' : 'adjusted',
    };
    save.mutate({ checkin, targets: keep ? null : { calorie_target: budget, ...macros } });
    setDone(true);
    success();
    showToast(keep ? `Check-in done · keeping ${formatInt(oldTarget)} kcal` : `Check-in done · ${formatInt(budget)} kcal a day from today`);
    if (!keep) startRef.current?.measureInWindow((x, y, w) => setBurst({ id: Date.now(), x: x + w / 2, y }));
    setTimeout(() => router.back(), keep ? 250 : 1100);
  }

  const goalLine = (() => {
    if (goalKg === null || trendKg === null || goal === 'maintain') return goal === 'maintain' ? 'Keeps your weight steady.' : null;
    if (daysNew === 0) return 'You’re at your goal weight.';
    if (daysNew === null) return 'At this budget your trend wouldn’t move towards your goal.';
    const date = formatShortDate(addDays(today, daysNew), today);
    if (daysOld === null) return `Goal weight around ${date}. Your current budget wouldn’t get you there.`;
    const diff = daysOld - daysNew;
    if (Math.abs(diff) < 3) return `Goal weight around ${date}, about the same as your current budget.`;
    return `Goal weight around ${date}: ${Math.abs(diff)} days ${diff > 0 ? 'sooner' : 'later'} than your current budget.`;
  })();

  const card = (() => {
    switch (step) {
      case 0:
        return (
          <>
            <Text variant="hero">
              {review.daysLogged} of 7 days
              <Text variant="title" color="textSecondary">
                {' '}
                logged
              </Text>
            </Text>
            <View style={styles.rings}>
              {review.logged.map((d) => (
                <View key={d.date} style={styles.ringCol}>
                  <ProgressRing size={36} stroke={4} fraction={d.logged ? 1 : 0} color={colors.accent} trackColor={colors.surface3} />
                  <Text variant="label">{LETTERS[fromISODate(d.date).getDay()]}</Text>
                </View>
              ))}
            </View>
            <Text variant="body" color="textSecondary">
              {consistencyText(review.daysLogged)}
            </Text>
            {review.avgIntake !== null ? (
              <Text variant="small" color="textSecondary" tabular>
                You ate {formatInt(review.avgIntake)} kcal a day on the days you logged, against a budget of {formatInt(oldTarget)}.
              </Text>
            ) : null}
          </>
        );
      case 1:
        return (
          <>
            <Text
              variant="hero"
              color={weekChange !== null && direction && Math.abs(weekChange) >= 0.05 && (weekChange < 0) === (direction === 'down') ? 'good' : 'text'}>
              {weekChange === null ? '–' : `${weekChange > 0 ? '+' : weekChange < 0 ? '−' : ''}${Math.abs(toDisplay(weekChange, units)).toFixed(2)} ${unit}`}
            </Text>
            <Text variant="small" color="textSecondary" tabular>
              {weekStartTrend !== null && weekEndTrend !== null
                ? `Trend ${weight(weekStartTrend)} → ${weight(weekEndTrend)} · ${weekWeighIns} weigh-in${weekWeighIns === 1 ? '' : 's'} this week`
                : `${weekWeighIns} weigh-in${weekWeighIns === 1 ? '' : 's'} this week`}
            </Text>
            {weekPoints.length > 1 ? <TrendChart points={weekPoints} units={units} goalKg={null} rangeKey="2w" height={150} /> : null}
            <Text variant="body" color="textSecondary">
              {paceText({ goal, changeKg: weekChange, planKgPerWeek: profile.goal_rate_kg_week, weight: amount })}
            </Text>
          </>
        );
      case 2:
        return (
          <>
            <Text variant="hero" tabular>
              {formatInt(r.kcal)}
              <Text variant="title" color="textSecondary">
                {' '}
                kcal / day
              </Text>
            </Text>
            <Text variant="small" color="textSecondary">
              {lastWeek === null
                ? 'Your first estimate.'
                : r.kcal === lastWeek
                  ? 'Same as last week.'
                  : `${r.kcal > lastWeek ? 'Up' : 'Down'} ${formatInt(Math.abs(r.kcal - lastWeek))} from last week.`}{' '}
              {confidenceText(r)}.
            </Text>
            {bars.length > 1 ? <ExpenditureBars bars={bars} /> : null}
            <Text variant="body" color="textSecondary">
              {r.fromData !== null && r.avgIntake !== null && r.trendChangeKg !== null
                ? `Over the last ${r.windowDays} days you ate ${formatInt(r.avgIntake)} kcal a day on ${r.loggedDays} logged days, and your trend moved ${r.trendChangeKg > 0 ? '+' : r.trendChangeKg < 0 ? '−' : ''}${amount(Math.abs(r.trendChangeKg))}. That points to about ${formatInt(r.fromData)} kcal a day; Fuel blends it with last week’s number so it moves steadily.`
                : 'This is what you burn in a day, including exercise. It starts from a formula using your stats and activity level, then learns from what you eat and how your trend moves once there are 7 logged days and 3 weigh-ins in the last 3 weeks.'}
            </Text>
          </>
        );
      default:
        return (
          <>
            <View style={styles.budgetRow}>
              <IconButton icon="minus" label={`Lower by ${BUDGET_STEP}`} size={44} onPress={() => adjust(-BUDGET_STEP)} disabled={budget <= floor} />
              <View style={styles.budgetValue} accessible accessibilityLabel={`${formatInt(budget)} kcal a day`}>
                <Text variant="hero" tabular>
                  {formatInt(budget)}
                </Text>
                <Text variant="caption" color="textSecondary">
                  kcal a day
                </Text>
              </View>
              <IconButton icon="plus" label={`Raise by ${BUDGET_STEP}`} size={44} onPress={() => adjust(BUDGET_STEP)} disabled={budget >= MAX_BUDGET} />
            </View>
            <Text variant="small" color="textSecondary" align="center" tabular>
              {budget === suggested ? 'Suggested' : `Suggested ${formatInt(suggested)}`} · now {formatInt(oldTarget)}
              {budget !== suggested ? (
                <Text variant="small" color="accent" onPress={() => setChosen(null)}>
                  {'  '}Reset
                </Text>
              ) : null}
            </Text>
            <View style={[styles.macros, { backgroundColor: colors.surface1, borderColor: colors.hairline }]}>
              {(
                [
                  ['Protein', macros.protein_g, 'protein'],
                  ['Carbs', macros.carbs_g, 'carbs'],
                  ['Fat', macros.fat_g, 'fat'],
                ] as const
              ).map(([label, g, color]) => (
                <View key={label} style={styles.macro}>
                  <View style={[styles.macroKey, { backgroundColor: colors[color] }]} />
                  <Text variant="caption" color="textSecondary">
                    {label}
                  </Text>
                  <Text variant="bodyStrong" tabular>
                    {g} g
                  </Text>
                </View>
              ))}
            </View>
            {goalLine ? (
              <View style={styles.goalLine}>
                <Icon name="flag" size={16} color="textSecondary" />
                <Text variant="small" color="textSecondary" style={styles.flex}>
                  {goalLine}
                </Text>
              </View>
            ) : null}
            {budget <= floor ? (
              <Text variant="caption" color="textTertiary">
                {formatInt(floor)} kcal is the lowest Fuel suggests on its own.
              </Text>
            ) : null}
          </>
        );
    }
  })();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.md }]}>
      <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.segment, { backgroundColor: i <= step ? colors.accent : colors.surface3 }]} />
        ))}
      </View>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="label">
            Weekly check-in · {formatShortDate(fromISODate(dates[0]), today)} – {formatShortDate(fromISODate(dates[6]), today)}
          </Text>
          <Text variant="heading" accessibilityRole="header">
            {STEPS[step]}
          </Text>
        </View>
        <IconButton icon="close" label="Close check-in" size={36} onPress={() => router.back()} />
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
        {/* Tap the card for the next one, or its left edge to go back, like a story. Not on the chart card (dragging reads the chart) or the budget. */}
        {step === 0 || step === 2 ? (
          <Pressable accessible={false} onPress={(e) => (e.nativeEvent.locationX < 80 && step > 0 ? back() : next())}>
            <Animated.View key={step} entering={FadeInDown.duration(260)} style={styles.card}>
              {card}
            </Animated.View>
          </Pressable>
        ) : (
          <Animated.View key={step} entering={FadeInDown.duration(260)} style={styles.card}>
            {card}
          </Animated.View>
        )}
      </ScrollView>

      <Animated.View entering={FadeIn} style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        {step < STEPS.length - 1 ? (
          <View style={styles.footerRow}>
            {step > 0 ? <Button label="Back" variant="ghost" onPress={back} /> : null}
            <View style={styles.flex}>
              <Button label="Next" onPress={next} />
            </View>
          </View>
        ) : (
          <>
            <View ref={startRef}>
              <Button label="Start next week" trailing={`${formatInt(budget)} kcal`} onPress={() => finish(false)} loading={save.isPending} />
            </View>
            <View style={styles.footerRow}>
              <Button label="Back" variant="ghost" onPress={back} />
              <View style={styles.flex}>
                <Button label={`Keep ${formatInt(oldTarget)} kcal`} variant="ghost" onPress={() => finish(true)} />
              </View>
            </View>
          </>
        )}
      </Animated.View>
      <Confetti burst={burst} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  progress: { flexDirection: 'row', gap: 4, paddingHorizontal: gutter },
  segment: { flex: 1, height: 3, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: gutter, paddingTop: space.md },
  body: { paddingHorizontal: gutter, paddingTop: space.xl, paddingBottom: space.xxl },
  card: { gap: space.lg },
  rings: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm },
  ringCol: { alignItems: 'center', gap: 6 },
  budgetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg },
  budgetValue: { alignItems: 'center', minWidth: 150 },
  macros: { flexDirection: 'row', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: space.md },
  macro: { flex: 1, gap: 3 },
  macroKey: { width: 14, height: 3, borderRadius: 2 },
  goalLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  footer: { paddingHorizontal: gutter, paddingTop: space.sm, gap: space.xs },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
