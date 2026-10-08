import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Tile } from '@/components/dashboard/MetricTiles';
import { TrendChart } from '@/components/progress/TrendChart';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useRefreshDashboard, useWeighIns } from '@/features/dashboard/api';
import { useProfile } from '@/features/profile/api';
import { agoText, goalProjection, goodDirection, pointsInRange, RANGES, toDisplay, unitLabel, type RangeKey } from '@/features/weight/logic';
import { formatShortDate, fromISODate, toISODate } from '@/lib/dates';
import { formatDayLabel } from '@/lib/format';
import { trendSeries, weeklyRate } from '@/lib/trend';
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

/** Your weight over time: the trend line, how fast it's moving, when you'll reach your goal, and every weigh-in. */
export default function ProgressScreen() {
  const { colors, scheme } = useTheme();
  const dotColor = scheme === 'dark' ? colors.textTertiary : colors.textSecondary;
  const now = new Date();
  const today = toISODate(now);
  const { data: profile } = useProfile();
  const weighIns = useWeighIns();
  const refresh = useRefreshDashboard();
  const [range, setRange] = useState<RangeKey>('1m');
  const [showAll, setShowAll] = useState(false);

  const units = profile?.units ?? 'metric';
  const unit = unitLabel(units);
  const all = useMemo(() => trendSeries(weighIns.data ?? []), [weighIns.data]);
  const shown = pointsInRange(all, range, now);
  const latest = all[all.length - 1];
  const rate = weeklyRate(all);
  const goalKg = profile?.goal_weight_kg ?? null;
  const direction = goodDirection(profile?.goal ?? null);
  const change = shown.length > 1 ? shown[shown.length - 1].trend - shown[0].trend : null;
  const projection = goalProjection({
    trendKg: latest?.trend ?? null,
    goalKg,
    weeklyRateKg: rate,
    planKgPerWeek: profile?.goal_rate_kg_week ?? null,
    today: now,
  });
  const rangeInfo = RANGES.find((r) => r.key === range) ?? RANGES[1];

  const show = (kg: number) => toDisplay(kg, units).toFixed(1);
  const signed = (kg: number, digits = 1) => `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${Math.abs(toDisplay(kg, units)).toFixed(digits)}`;
  /** Weekly rates are small, so they get two decimals (0.24 kg/wk, not 0.2). */
  const rateText = (kg: number) => Math.abs(toDisplay(kg, units)).toFixed(2);
  /** Green when moving the way your goal wants; never red, since a bad week isn't a failure. */
  const changeColor = (kg: number | null): ColorName => {
    if (kg === null || Math.abs(kg) < 0.05 || !direction) return 'textSecondary';
    return (kg < 0) === (direction === 'down') ? 'good' : 'textSecondary';
  };

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
    <Screen
      eyebrow={all[0] ? `Since ${formatShortDate(fromISODate(all[0].date))}` : 'Weight'}
      title="Progress"
      accessory={<WeighInButton done={latest?.date === today} />}
      onRefresh={refresh}>
      <ChipGroup scroll label="Range">
        {RANGES.map((r) => (
          <Chip key={r.key} label={r.label} selected={range === r.key} onPress={() => setRange(r.key)} />
        ))}
      </ChipGroup>

      <Card style={styles.chartCard}>
        <View style={styles.chartHead}>
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
        <Tile
          label="To goal"
          value={latest && goalKg !== null ? show(Math.abs(latest.trend - goalKg)) : '–'}
          unit={latest && goalKg !== null ? unit : undefined}
          sub={goalKg !== null ? `Goal ${show(goalKg)} ${unit}` : 'No goal weight set'}
        />
      </View>
      <View style={styles.tiles}>
        <Tile
          label="Goal date"
          value={projection.kind === 'date' ? formatShortDate(projection.date, now) : projection.kind === 'reached' ? 'Reached' : '–'}
          sub={
            projection.kind === 'date'
              ? projection.basis === 'trend'
                ? `At your pace, ${rateText(projection.kgPerWeek)} ${unit}/wk`
                : `At your planned ${rateText(projection.kgPerWeek)} ${unit}/wk`
              : projection.kind === 'reached'
                ? 'Your trend is at your goal'
                : projection.kind === 'away'
                  ? 'Trend is moving the other way this week'
                  : 'Shows once you have a goal and a trend'
          }
        />
        <Tile
          label="Weigh-ins"
          value={String(all.length)}
          sub={latest ? `Last ${agoText(latest.date, today)}` : undefined}
        />
      </View>

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
  );
}

const styles = StyleSheet.create({
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
  list: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowText: { flex: 1, gap: 2 },
});
