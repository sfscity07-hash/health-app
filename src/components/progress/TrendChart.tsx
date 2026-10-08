import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { toDisplay, unitLabel, type Units } from '@/features/weight/logic';
import { linePath, nearestIndex, niceTicks, scale, valueDomain } from '@/lib/chart';
import { daysBetween, formatShortDate, fromISODate } from '@/lib/dates';
import { tick } from '@/lib/haptics';
import type { TrendPoint } from '@/lib/trend';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

const PAD = { left: 38, right: 14, top: 14 };
const AXIS_BAND = 24;
const TOOLTIP_W = 150;
/** Past this many weigh-ins the dots shrink, so a year of data doesn't turn into a smear. */
const DENSE = 90;

type TrendChartProps = {
  points: TrendPoint[];
  units: Units;
  goalKg: number | null;
  /** Plot height, not counting the date labels underneath. */
  height?: number;
  /** Changes when the range changes, to fade the new view in. */
  rangeKey: string;
};

/**
 * Trend weight over time: the trend as the line, each scale weigh-in as a
 * quiet dot, your goal as a labelled reference line. Press and drag to read
 * any day.
 */
export function TrendChart({ points, units, goalKg, height = 190, rangeKey }: TrendChartProps) {
  const { colors, scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const unit = unitLabel(units);
  const dotColor = scheme === 'dark' ? colors.textTertiary : colors.textSecondary;

  const geo = useMemo(() => {
    if (width === 0 || points.length === 0) return null;
    const plotW = width - PAD.left - PAD.right;
    const values = points.flatMap((p) => [toDisplay(p.kg, units), toDisplay(p.trend, units)]);
    const goal = goalKg === null ? null : toDisplay(goalKg, units);
    const domain = valueDomain(values, goal, units === 'imperial' ? 2 : 1);
    const y = scale(domain.min, domain.max, PAD.top + height, PAD.top);
    const first = points[0].date;
    const span = daysBetween(first, points[points.length - 1].date);
    const x = (date: string) => (span === 0 ? PAD.left + plotW / 2 : PAD.left + (daysBetween(first, date) / span) * plotW);
    const xs = points.map((p) => x(p.date));
    const ticks = niceTicks(domain.min, domain.max, 4).filter((t) => t >= domain.min && t <= domain.max);
    return {
      xs,
      y,
      ticks,
      goalY: goal !== null && domain.includesReference ? y(goal) : null,
      goal,
      trendPath: linePath(points.map((p, i) => ({ x: xs[i], y: y(toDisplay(p.trend, units)) }))),
    };
  }, [width, points, units, goalKg, height]);

  function pick(px: number) {
    if (!geo) return;
    const i = nearestIndex(geo.xs, px);
    if (i !== active) {
      tick();
      setActive(i);
    }
  }

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onStart((e) => pick(e.x))
    .onUpdate((e) => pick(e.x))
    .onFinalize(() => setActive(null));
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      if (!geo) return;
      const i = nearestIndex(geo.xs, e.x);
      setActive((a) => (a === i ? null : i));
      tick();
    });

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const last = points[points.length - 1];
  const fmt = (kg: number) => toDisplay(kg, units).toFixed(1);
  const sel = active !== null && geo ? { p: points[active], x: geo.xs[active] } : null;
  const summary = last
    ? `Trend weight chart from ${formatShortDate(fromISODate(points[0].date))}: ${fmt(points[0].trend)} to ${fmt(last.trend)} ${unit}.`
    : 'No weigh-ins in this range.';

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <View onLayout={onLayout} style={{ height: PAD.top + height + AXIS_BAND }} accessible accessibilityLabel={summary}>
        {geo ? (
          <Animated.View key={rangeKey} entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
            <Svg width={width} height={PAD.top + height + AXIS_BAND}>
              {geo.ticks.map((t) => (
                <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke={colors.hairline} strokeWidth={1} />
              ))}
              {geo.goalY !== null ? (
                <Line x1={PAD.left} x2={width - PAD.right} y1={geo.goalY} y2={geo.goalY} stroke={colors.textSecondary} strokeWidth={1} opacity={0.7} />
              ) : null}
              {points.map((p, i) => (
                <Circle
                  key={p.date}
                  cx={geo.xs[i]}
                  cy={geo.y(toDisplay(p.kg, units))}
                  r={points.length > DENSE ? 2 : 3.5}
                  fill={dotColor}
                  stroke={points.length > DENSE ? 'none' : colors.surface1}
                  strokeWidth={2}
                  opacity={points.length > DENSE ? 0.6 : 1}
                />
              ))}
              {points.length > 1 ? (
                <Path d={geo.trendPath} stroke={colors.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              ) : null}
              {last ? (
                <Circle cx={geo.xs[geo.xs.length - 1]} cy={geo.y(toDisplay(last.trend, units))} r={4.5} fill={colors.accent} stroke={colors.surface1} strokeWidth={2} />
              ) : null}
              {sel ? (
                <>
                  <Line x1={sel.x} x2={sel.x} y1={PAD.top} y2={PAD.top + height} stroke={colors.textTertiary} strokeWidth={1} />
                  <Circle cx={sel.x} cy={geo.y(toDisplay(sel.p.kg, units))} r={4.5} fill={dotColor} stroke={colors.surface1} strokeWidth={2} />
                  <Circle cx={sel.x} cy={geo.y(toDisplay(sel.p.trend, units))} r={5} fill={colors.accent} stroke={colors.surface1} strokeWidth={2} />
                </>
              ) : null}
            </Svg>

            {geo.ticks.map((t) => (
              <Text key={t} variant="label" tabular style={[styles.yLabel, { top: geo.y(t) - 7 }]}>
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </Text>
            ))}
            {geo.goalY !== null && geo.goal !== null ? (
              <Text variant="label" color="textSecondary" style={[styles.goalLabel, { top: geo.goalY - 15, right: PAD.right }]}>
                Goal {geo.goal.toFixed(1)}
              </Text>
            ) : null}
            {last && !sel ? (
              <Text
                variant="caption"
                color="text"
                tabular
                style={[styles.endLabel, { top: geo.y(toDisplay(last.trend, units)) - 22, right: Math.max(0, width - geo.xs[geo.xs.length - 1] - 18) }]}>
                {fmt(last.trend)}
              </Text>
            ) : null}

            <View style={[styles.xAxis, { top: PAD.top + height + 6, left: PAD.left, right: PAD.right }]}>
              <Text variant="label">{formatShortDate(fromISODate(points[0].date))}</Text>
              {points.length > 2 ? <Text variant="label">{formatShortDate(fromISODate(points[Math.floor(points.length / 2)].date))}</Text> : null}
              {points.length > 1 ? <Text variant="label">{formatShortDate(fromISODate(last.date))}</Text> : null}
            </View>

            {sel ? (
              <View
                pointerEvents="none"
                style={[
                  styles.tooltip,
                  { backgroundColor: colors.surface3, left: Math.min(Math.max(sel.x - TOOLTIP_W / 2, 0), width - TOOLTIP_W) },
                ]}>
                <Text variant="caption" color="textSecondary">
                  {formatShortDate(fromISODate(sel.p.date))}
                </Text>
                <View style={styles.tipRow}>
                  <View style={[styles.lineKey, { backgroundColor: colors.accent }]} />
                  <Text variant="bodyStrong" tabular>
                    {fmt(sel.p.trend)} {unit}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    trend
                  </Text>
                </View>
                <View style={styles.tipRow}>
                  <View style={[styles.dotKey, { backgroundColor: dotColor }]} />
                  <Text variant="small" color="textSecondary" tabular>
                    {fmt(sel.p.kg)} {unit} scale
                  </Text>
                </View>
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  yLabel: { position: 'absolute', left: 0, width: PAD.left - 8, textAlign: 'right' },
  goalLabel: { position: 'absolute' },
  endLabel: { position: 'absolute', fontWeight: '600' },
  xAxis: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  tooltip: { position: 'absolute', top: 0, width: TOOLTIP_W, padding: space.sm, borderRadius: radius.md, gap: 2 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineKey: { width: 12, height: 2, borderRadius: 1 },
  dotKey: { width: 7, height: 7, borderRadius: 4, marginHorizontal: 2.5 },
});
