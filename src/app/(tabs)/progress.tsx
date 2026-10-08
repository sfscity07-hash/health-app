import { router, useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Confetti, type Burst } from '@/components/dashboard/Confetti';
import { Tile } from '@/components/dashboard/MetricTiles';
import { CalorieBars } from '@/components/progress/CalorieBars';
import { GoalJourney } from '@/components/progress/GoalJourney';
import { Heatmap } from '@/components/progress/Heatmap';
import { MacroSplitBar } from '@/components/progress/MacroSplitBar';
import { Milestones } from '@/components/progress/Milestones';
import { TrendChart } from '@/components/progress/TrendChart';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCheckins } from '@/features/checkin/api';
import { budgetOn } from '@/features/checkin/logic';
import { useClosures, useDaySummaries, useRefreshDashboard, useWeighIns } from '@/features/dashboard/api';
import {
  badges as buildBadges,
  calorieWeek,
  daysTo,
  heatmap,
  HEAT_WEEKS,
  isNear,
  journey as buildJourney,
  macroSplit,
  newlyEarned,
  proteinDays,
} from '@/features/progress/logic';
import { readSeen, writeSeen } from '@/features/progress/seen';
import { useProfile } from '@/features/profile/api';
import { agoText, goalProjection, goodDirection, pointsInRange, RANGES, toDisplay, unitLabel, type RangeKey } from '@/features/weight/logic';
import { addDays, formatShortDate, fromISODate, toISODate, weekOf } from '@/lib/dates';
import { formatDayLabel, formatInt } from '@/lib/format';
import { success } from '@/lib/haptics';
import { streaks } from '@/lib/streak';
import { trendSeries, weeklyRate } from '@/lib/trend';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { space, type ColorName } from '@/theme/tokens';

const LIST_PREVIEW = 10;

const openWeighIn = (date?: string) => router.push({ pathname: '/weigh-in', params: date ? { date } : {} });

function WeighInButton({ done }: { done: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={done ? 'Weighed in today. Tap to change it.' : 'Weigh in'}
      haptic="tap"
      pressedScale={0.94}
      onPress={() => openWeighIn()}
      style={[styles.pill, { backgroundColor: done ? colors.surface1 : colors.accentSoft, borderColor: done ? colors.hairline : 'transparent' }]}>
      <Icon name={done ? 'check' : 'plus'} size={15} color={done ? 'good' : 'accent'} strokeWidth={2.4} />
      <Text variant="smallStrong" color={done ? 'text' : 'accent'}>
        {done ? 'Weighed in' : 'Weigh in'}
      </Text>
    </PressableScale>
  );
}

function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text variant="heading">{title}</Text>
      {note ? (
        <Text variant="caption" color="textSecondary" tabular>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** Your journey: weight trend, goal, calories, macros, milestones and consistency. */
export default function ProgressScreen() {
  const { colors, scheme } = useTheme();
  const { session } = useAuth();
  const focused = useIsFocused();
  const showToast = useToast((s) => s.show);
  const dotColor = scheme === 'dark' ? colors.textTertiary : colors.textSecondary;
  const now = new Date();
  const today = toISODate(now);
  const heatStart = toISODate(addDays(weekOf(now)[0], -7 * (HEAT_WEEKS - 1)));
  const { data: profile } = useProfile();
  const weighIns = useWeighIns();
  const summaries = useDaySummaries(heatStart, today);
  const closures = useClosures();
  const checkins = useCheckins();
  const refresh = useRefreshDashboard();
  const [range, setRange] = useState<RangeKey>('1m');
  const [showAll, setShowAll] = useState(false);
  const [burst, setBurst] = useState<Burst | null>(null);
  const topRef = useRef<View>(null);

  const units = profile?.units ?? 'metric';
  const unit = unitLabel(units);
  const all = useMemo(() => trendSeries(weighIns.data ?? []), [weighIns.data]);
  const shown = pointsInRange(all, range, now);
  const latest = all[all.length - 1];
  const rate = weeklyRate(all);
  const goalKg = profile?.goal_weight_kg ?? null;
  const goal = profile?.goal ?? null;
  const direction = goodDirection(goal);
  const change = shown.length > 1 ? shown[shown.length - 1].trend - shown[0].trend : null;
  const rangeInfo = RANGES.find((r) => r.key === range) ?? RANGES[1];

  const show = (kg: number) => toDisplay(kg, units).toFixed(1);
  const signed = (kg: number, digits = 1) => `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${Math.abs(toDisplay(kg, units)).toFixed(digits)}`;
  const rateText = (kg: number) => Math.abs(toDisplay(kg, units)).toFixed(2);
  /** Green when moving the way your goal wants; never red, since a bad week isn't a failure. */
  const changeColor = (kg: number | null): ColorName => {
    if (kg === null || Math.abs(kg) < 0.05 || !direction) return 'textSecondary';
    return (kg < 0) === (direction === 'down') ? 'good' : 'textSecondary';
  };

  // Goal journey, from your first weigh-in to your goal weight.
  const journey = latest && goalKg !== null && goal !== 'maintain' ? buildJourney(all[0].trend, latest.trend, goalKg) : null;
  const projection = goalProjection({
    trendKg: latest?.trend ?? null,
    goalKg,
    weeklyRateKg: rate,
    planKgPerWeek: profile?.goal_rate_kg_week ?? null,
    today: now,
  });
  const projectionText =
    projection.kind === 'date'
      ? `${projection.basis === 'trend' ? 'At your current pace' : `At your planned ${rateText(projection.kgPerWeek)} ${unit}/week`} you reach ${goalKg !== null ? `${show(goalKg)} ${unit}` : 'your goal'} around ${formatShortDate(projection.date, now)}.`
      : projection.kind === 'reached'
        ? 'You’ve reached your goal weight. Keep logging to hold it there.'
        : projection.kind === 'away'
          ? 'Your trend moved away from your goal this week. Your next check-in adjusts the budget for it.'
          : 'Weigh in for a week to see when you’ll get there.';

  // Calories and macros. Budgets change at check-ins, so each day gets the one it had.
  const days = summaries.data ?? {};
  const budgetFor = (date: string) => budgetOn(date, checkins.data ?? [], profile?.calorie_target ?? 2000);
  const week = calorieWeek(today, days, budgetFor);
  const pastWeek = week.filter((d) => !d.isToday).map((d) => days[d.date]).filter(Boolean);
  const avgKcal = week.filter((d) => !d.isToday && d.logged);
  const split = macroSplit(pastWeek);
  const proteinHit = proteinDays(pastWeek, profile?.protein_g ?? 0);
  const proteinLogged = pastWeek.filter((d) => d.food_entries > 0).length;

  // Consistency and milestones.
  const closedDays = closures.data ?? [];
  const closed = useMemo(() => new Set(closures.data ?? []), [closures.data]);
  const streak = streaks(closedDays, today);
  const heat = heatmap(today, days, closed);
  const thisWeek = heat.columns[heat.columns.length - 1];
  const isLogged = (level: string) => level === 'logged' || level === 'finished';
  const perfectWeekBefore = heat.columns.slice(0, -1).some((w) => w.days.every((d) => isLogged(d.level)));
  const list = buildBadges({
    goal,
    units,
    loggedThisWeek: thisWeek ? thisWeek.days.filter((d) => isLogged(d.level)).length : 0,
    perfectWeekBefore,
    streak,
    proteinDays: proteinHit,
    movedKg: journey?.doneKg ?? 0,
    journeyFraction: journey?.fraction ?? null,
    checkins: (checkins.data ?? []).length,
  });
  const near = list.filter(isNear).length;
  const passedMilestones = journey ? journey.milestones.filter((m) => (journey.goalKg < journey.startKg ? journey.trendKg <= m : journey.trendKg >= m)) : [];
  const earnedKeys = [...list.filter((b) => b.done).map((b) => b.key), ...passedMilestones.map((m) => `mile-${m}`)];
  const ready = summaries.isSuccess && closures.isSuccess && checkins.isSuccess && weighIns.isSuccess && Boolean(profile);
  const earnedSignature = earnedKeys.join(',');

  // Celebrate milestones earned since you last looked (once each).
  useEffect(() => {
    const userId = session?.user.id;
    if (!focused || !ready || !userId) return;
    const seen = readSeen(userId);
    const earned = earnedSignature ? earnedSignature.split(',') : [];
    const fresh = newlyEarned(earned, seen);
    writeSeen(userId, Array.from(new Set([...(seen ?? []), ...earned])));
    if (fresh.length === 0) return;
    const first = fresh[0];
    const title = first.startsWith('mile-')
      ? `You passed ${toDisplay(Number(first.slice(5)), units).toFixed(1)} ${unitLabel(units)}`
      : `Milestone: ${list.find((b) => b.key === first)?.title ?? 'new badge'}`;
    success();
    showToast(fresh.length > 1 ? `${title} (+${fresh.length - 1} more)` : title);
    topRef.current?.measureInWindow((x, y, w) => setBurst({ id: Date.now(), x: x + w / 2, y: y + 40 }));
    // `list` and `units` only matter through `earnedSignature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, ready, earnedSignature, session?.user.id]);

  const history = [...all].reverse();
  const listed = showAll ? history : history.slice(0, LIST_PREVIEW);

  if (!weighIns.isPending && all.length === 0) {
    return (
      <Screen eyebrow="Weight" title="Progress" onRefresh={refresh}>
        <EmptyState
          icon="scale"
          title="Your trend starts with one weigh-in"
          body="Weigh in most mornings. Fuel smooths out the daily water swings into a trend line, so you see where you’re really heading."
        />
        <Button label="Weigh in" icon="plus" onPress={() => openWeighIn()} />
      </Screen>
    );
  }

  return (
    <View style={styles.root}>
      <Screen
        eyebrow={all[0] ? `Since ${formatShortDate(fromISODate(all[0].date))}` : 'Weight'}
        title="Progress"
        accessory={<WeighInButton done={latest?.date === today} />}
        onRefresh={refresh}>
        <View ref={topRef} collapsable={false}>
          {journey ? (
            <GoalJourney
              journey={journey}
              units={units}
              nextInDays={journey.next !== null ? daysTo(journey.trendKg, journey.next, rate) : null}
              projection={projectionText}
            />
          ) : null}
        </View>

        <ChipGroup scroll label="Range">
          {RANGES.map((r) => (
            <Chip key={r.key} label={r.label} selected={range === r.key} onPress={() => setRange(r.key)} />
          ))}
        </ChipGroup>

        <Card style={styles.chartCard}>
          <View style={styles.chartHead}>
            {/* The journey card already shows your trend weight; don't repeat it. */}
            {journey ? (
              <Text variant="heading">Weight</Text>
            ) : (
              <View>
                <Text variant="label">Trend weight</Text>
                <Text variant="title">
                  {latest ? show(latest.trend) : '–'}
                  <Text variant="body" color="textSecondary">
                    {' '}
                    {unit}
                  </Text>
                </Text>
              </View>
            )}
            {change !== null ? (
              <View style={styles.changeCol}>
                <Text variant="bodyStrong" color={changeColor(change)} tabular>
                  {signed(change)} {unit}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {rangeInfo.phrase}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.legendItem}>
              <View style={[styles.lineKey, { backgroundColor: colors.accent }]} />
              <Text variant="caption" color="textSecondary">
                Trend
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dotKey, { backgroundColor: dotColor }]} />
              <Text variant="caption" color="textSecondary">
                Scale weight
              </Text>
            </View>
          </View>
          {shown.length > 0 ? (
            <TrendChart points={shown} units={units} goalKg={goalKg} rangeKey={range} />
          ) : (
            <Text variant="small" color="textSecondary" style={styles.noRange}>
              No weigh-ins in this range. Pick a longer one, or weigh in today.
            </Text>
          )}
          <Text variant="caption" color="textTertiary">
            Press and drag on the chart to read any day.
          </Text>
        </Card>

        <View style={styles.tiles}>
          <Tile
            label="Weekly rate"
            value={rate === null ? '–' : signed(rate, 2)}
            unit={rate === null ? undefined : `${unit}/wk`}
            sub={
              rate === null ? (
                'Needs a week of weigh-ins'
              ) : (
                <Text variant="caption" color={changeColor(rate)}>
                  {Math.abs(rate) < 0.05 ? 'Holding steady' : rate < 0 ? 'Trend going down' : 'Trend going up'}
                </Text>
              )
            }
          />
          <Tile label="Weigh-ins" value={String(all.length)} sub={latest ? `Last ${agoText(latest.date, today)}` : undefined} />
        </View>

        <Card style={styles.section}>
          <SectionHead
            title="Calories"
            note={avgKcal.length ? `Avg ${formatInt(avgKcal.reduce((s, d) => s + d.kcal, 0) / avgKcal.length)} kcal` : undefined}
          />
          <CalorieBars days={week} />
        </Card>

        {split ? (
          <Card style={styles.section}>
            <SectionHead title="Macros" note={`Last ${split.days} logged day${split.days === 1 ? '' : 's'}`} />
            <MacroSplitBar split={split} targets={{ protein_g: profile?.protein_g ?? 0, carbs_g: profile?.carbs_g ?? 0, fat_g: profile?.fat_g ?? 0 }} />
            <View style={[styles.proteinRow, { borderTopColor: colors.hairline }]}>
              <Icon name="target" size={16} color="protein" />
              <Text variant="small" color="textSecondary" style={styles.flex}>
                Protein target hit on{' '}
                <Text variant="small" color="text">
                  {proteinHit} of {proteinLogged}
                </Text>{' '}
                logged days this week.
              </Text>
            </View>
          </Card>
        ) : null}

        <View style={styles.milestones}>
          <SectionHead title="Milestones" note={near > 0 ? `${near} within reach` : `${list.filter((b) => b.done).length} of ${list.length} earned`} />
          <Milestones badges={list} />
        </View>

        <Card style={styles.section}>
          <SectionHead title="Consistency" note={`${streak.current}-day streak · best ${streak.best}`} />
          <Heatmap weeks={heat.columns} logged={heat.logged} finished={heat.finished} />
        </Card>

        <Card style={styles.list}>
          <View style={styles.listHead}>
            <Text variant="heading">Weigh-ins</Text>
            <Text variant="caption" color="textSecondary">
              Tap one to change it
            </Text>
          </View>
          {listed.map((w, i) => {
            const diff = w.kg - w.trend;
            return (
              <PressableScale
                key={w.date}
                accessibilityRole="button"
                accessibilityLabel={`${formatDayLabel(fromISODate(w.date))}: ${show(w.kg)} ${unit}, trend ${show(w.trend)}. Tap to change.`}
                pressedScale={0.985}
                onPress={() => openWeighIn(w.date)}
                style={[styles.row, i > 0 && { borderTopColor: colors.hairline, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
                <View style={styles.rowText}>
                  <Text variant="body">{w.date === today ? 'Today' : formatDayLabel(fromISODate(w.date))}</Text>
                  <Text variant="caption" color="textTertiary" tabular>
                    Trend {show(w.trend)} · {Math.abs(diff) < 0.05 ? 'on trend' : `${signed(diff)} vs trend`}
                  </Text>
                </View>
                <Text variant="bodyStrong" tabular>
                  {show(w.kg)}
                  <Text variant="caption" color="textTertiary">
                    {' '}
                    {unit}
                  </Text>
                </Text>
              </PressableScale>
            );
          })}
          {history.length > LIST_PREVIEW ? (
            <Button label={showAll ? 'Show fewer' : `Show all ${history.length}`} variant="ghost" onPress={() => setShowAll((s) => !s)} />
          ) : null}
        </Card>
      </Screen>
      <Confetti burst={burst} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  chartCard: { padding: space.lg, gap: space.md },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  changeCol: { alignItems: 'flex-end' },
  legend: { flexDirection: 'row', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineKey: { width: 14, height: 2, borderRadius: 1 },
  dotKey: { width: 7, height: 7, borderRadius: 4 },
  noRange: { paddingVertical: space.xl },
  tiles: { flexDirection: 'row', gap: 10 },
  section: { padding: space.lg, gap: space.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  proteinRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  milestones: { gap: space.md, marginTop: space.xs },
  list: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowText: { flex: 1, gap: 2 },
});
