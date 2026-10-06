import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { CalorieGauge } from '@/components/CalorieGauge';
import { Confetti, type Burst } from '@/components/dashboard/Confetti';
import { FinishDayButton } from '@/components/dashboard/FinishDayButton';
import { FoodTimeline } from '@/components/dashboard/FoodTimeline';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { MacroSummary } from '@/components/dashboard/MacroSummary';
import { MiniBar, Sparkline, Tile, WaterTile } from '@/components/dashboard/MetricTiles';
import { WeekRings, type WeekDay } from '@/components/dashboard/WeekRings';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import {
  emptyDay,
  useAddWater,
  useClosures,
  useCloseDay,
  useDaySummaries,
  useFoodLogs,
  useRefreshDashboard,
  useRemoveWater,
  useWeighIns,
} from '@/features/dashboard/api';
import { buildInsights } from '@/features/dashboard/insights';
import { useProfile } from '@/features/profile/api';
import { addDays, ageOn, dayName, fromISODate, toISODate, weekOf } from '@/lib/dates';
import { formatDayLabel, formatInt, greetingFor } from '@/lib/format';
import { success } from '@/lib/haptics';
import { mealForTime, type Meal } from '@/lib/meals';
import { maintenanceCalories } from '@/lib/nutrition';
import { streaks } from '@/lib/streak';
import { nextMilestone, trendSeries, weeklyRate } from '@/lib/trend';
import { displayWeight, kgToLb } from '@/lib/units';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const TIMELINE_ORDER: Meal[] = ['breakfast', 'lunch', 'snack', 'dinner'];

function GaugeFoot({ value, label }: { value: number; label: string }) {
  return (
    <>
      <AnimatedNumber value={value} variant="bodyStrong" />
      <Text variant="label">{label}</Text>
    </>
  );
}

function StreakPill({ count }: { count: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.streak, { backgroundColor: colors.surface1, borderColor: colors.hairline }]}
      accessible
      accessibilityLabel={`${count}-day streak`}>
      <Icon name="flame" size={16} color="flame" filled />
      <Animated.View key={count} entering={ZoomIn.springify().damping(12)}>
        <Text variant="bodyStrong" tabular>
          {count}
        </Text>
      </Animated.View>
    </View>
  );
}

export default function DashboardScreen() {
  const now = new Date();
  const today = toISODate(now);
  const yesterday = toISODate(addDays(now, -1));
  const [selected, setSelected] = useState(today);
  const selectedDate = fromISODate(selected);
  const isToday = selected === today;

  const week = weekOf(now).map(toISODate);
  const { data: profile } = useProfile();
  const summaries = useDaySummaries(week[0], week[6]);
  const logs = useFoodLogs(selected);
  const weighIns = useWeighIns();
  const closures = useClosures();
  const addWater = useAddWater();
  const removeWater = useRemoveWater();
  const closeDay = useCloseDay();
  const refresh = useRefreshDashboard();

  const finishRef = useRef<View>(null);
  const [burst, setBurst] = useState<Burst | null>(null);

  const units = profile?.units ?? 'metric';
  const budget = profile?.calorie_target ?? 2000;
  const day = summaries.data?.[selected] ?? emptyDay(selected);
  const addback = profile?.exercise_addback ? day.kcal_out : 0;
  const dayBudget = budget + addback;
  const left = dayBudget - day.kcal_in;
  const over = left < 0;

  const closedDays = useMemo(() => closures.data ?? [], [closures.data]);
  const streak = streaks(closedDays, today);
  const closed = closedDays.includes(selected);

  const trend = useMemo(() => trendSeries(weighIns.data ?? []), [weighIns.data]);
  const latest = trend[trend.length - 1];
  const rate = weeklyRate(trend);
  const goalWeight = profile?.goal_weight_kg ?? null;
  const milestone = latest && goalWeight !== null ? nextMilestone(latest.trend, goalWeight) : null;

  const maintenance =
    profile?.sex && profile.birth_date && profile.height_cm && profile.activity_level && latest
      ? maintenanceCalories({
          sex: profile.sex,
          age: ageOn(fromISODate(profile.birth_date), now),
          heightCm: profile.height_cm,
          weightKg: latest.trend,
          activity: profile.activity_level,
        })
      : null;

  const entries = logs.data ?? [];
  const filled = new Set(entries.map((e) => e.meal));
  let nextMeal: Meal | null = null;
  if (isToday) {
    const start = TIMELINE_ORDER.indexOf(mealForTime(now));
    nextMeal = [...TIMELINE_ORDER.slice(start), ...TIMELINE_ORDER.slice(0, start)].find((m) => !filled.has(m)) ?? null;
  }

  const weekDays: WeekDay[] = week.map((date, i) => {
    const s = summaries.data?.[date];
    return {
      date,
      letter: LETTERS[i],
      dayOfMonth: fromISODate(date).getDate(),
      fraction: s ? s.kcal_in / budget : 0,
      closed: closedDays.includes(date),
      over: s ? s.kcal_in > budget * 1.05 : false,
      future: date > today,
      isToday: date === today,
    };
  });

  const weight = (kg: number) => displayWeight(kg, units);
  const insights = buildInsights({
    isToday,
    hour: now.getHours(),
    budget: dayBudget,
    eatenKcal: day.kcal_in,
    foodEntries: day.food_entries,
    protein: { eaten: day.protein_g, target: profile?.protein_g ?? 0 },
    streak: streak.current,
    closedToday: streak.closedToday,
    goal: profile?.goal ?? null,
    trendKg: latest?.trend ?? null,
    goalWeightKg: goalWeight,
    milestoneKg: milestone,
    weight,
  });

  const canFinish = !closed && (isToday || selected === yesterday);

  function finish() {
    closeDay.mutate({ date: selected });
    success();
    finishRef.current?.measureInWindow((x, y, w, h) => setBurst({ id: Date.now(), x: x + w - 36, y: y + h / 2 }));
  }

  const trendValue = latest ? (units === 'imperial' ? kgToLb(latest.trend) : latest.trend) : null;
  const rateValue = rate === null ? null : units === 'imperial' ? kgToLb(rate) : rate;
  const unit = units === 'imperial' ? 'lb' : 'kg';

  return (
    <View style={styles.root}>
      <Screen
        eyebrow={formatDayLabel(selectedDate)}
        title={isToday ? greetingFor(now) : dayName(selectedDate)}
        accessory={<StreakPill count={streak.current} />}
        onRefresh={refresh}>
        <WeekRings days={weekDays} selected={selected} onSelect={setSelected} />

        <View style={styles.gauge}>
          <CalorieGauge
            fraction={dayBudget > 0 ? day.kcal_in / dayBudget : 0}
            over={over}
            startLabel={<GaugeFoot value={day.kcal_in} label="Eaten" />}
            endLabel={<GaugeFoot value={dayBudget} label={addback ? 'Budget + ex.' : 'Budget'} />}>
            <AnimatedNumber value={Math.abs(left)} variant="display" />
            <Text variant="caption" color="textSecondary">
              {over ? 'kcal over budget' : 'kcal remaining'}
            </Text>
          </CalorieGauge>
        </View>

        {summaries.isError ? (
          <Text variant="small" color="warn">
            Couldn&apos;t load this day. Pull down to try again.
          </Text>
        ) : null}

        <MacroSummary
          macros={[
            { label: 'Protein', eaten: day.protein_g, target: profile?.protein_g ?? 0, color: 'protein' },
            { label: 'Carbs', eaten: day.carbs_g, target: profile?.carbs_g ?? 0, color: 'carbs' },
            { label: 'Fat', eaten: day.fat_g, target: profile?.fat_g ?? 0, color: 'fat' },
          ]}
        />

        <InsightCard insights={insights} />

        <View style={styles.tiles}>
          <Tile
            label="Trend weight"
            meta={trend.length > 1 ? `${Math.min(trend.length, 21)}D` : undefined}
            value={trendValue === null ? '–' : trendValue.toFixed(1)}
            unit={trendValue === null ? undefined : unit}
            sub={
              rateValue !== null ? (
                <Text variant="caption" color={rateValue <= 0 ? 'good' : 'textSecondary'}>
                  {rateValue <= 0 ? '▼' : '▲'} {Math.abs(rateValue).toFixed(2)} {unit} / wk
                </Text>
              ) : latest ? (
                `${trend.length} weigh-in${trend.length === 1 ? '' : 's'} so far`
              ) : (
                'No weigh-ins yet'
              )
            }
            footer={<Sparkline values={trend.slice(-21).map((p) => p.trend)} color="accent" />}
          />
          <Tile
            label="Expenditure"
            meta="EST"
            value={maintenance ? formatInt(maintenance) : '–'}
            unit={maintenance ? 'kcal' : undefined}
            sub="Formula estimate · learns from check-ins"
          />
        </View>
        <View style={styles.tiles}>
          <WaterTile
            ml={day.water_ml}
            goalMl={profile?.water_goal_ml ?? 2500}
            onAdd={() => addWater.mutate({ date: selected, ml: 250 })}
            onUndo={() => removeWater.mutate({ date: selected })}
          />
          <Tile
            label="Exercise"
            value={formatInt(day.kcal_out)}
            unit="kcal"
            sub="Workout logging arrives in Phase 9"
            footer={<MiniBar fraction={0} color="textSecondary" />}
          />
        </View>

        <View style={styles.sectionHead}>
          <Text variant="heading">{isToday ? "Today's food" : `${dayName(selectedDate)}'s food`}</Text>
          <Text variant="small" color="textSecondary" tabular>
            {formatInt(day.kcal_in)} kcal
          </Text>
        </View>
        <FoodTimeline entries={entries} nextMeal={nextMeal} kcalLeft={left} onAdd={() => router.push('/log')} />

        {canFinish || closed ? (
          <FinishDayButton
            ref={finishRef}
            closed={closed}
            dayWord={isToday ? 'today' : 'yesterday'}
            streak={streak.current}
            best={streak.best}
            busy={closeDay.isPending}
            onPress={finish}
          />
        ) : null}
      </Screen>
      <Confetti burst={burst} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingLeft: 10,
    paddingRight: 13,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  gauge: { alignItems: 'center', marginTop: -space.xs },
  tiles: { flexDirection: 'row', gap: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.xs },
});
