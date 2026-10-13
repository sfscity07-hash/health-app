import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { balanceWord, type DeficitDay } from '@/features/deficit/logic';
import { fromISODate } from '@/lib/dates';
import { formatInt } from '@/lib/format';
import { useTheme } from '@/theme/theme';

const HEIGHT = 168;
const LABELS = 22; // day letters under the plot
const TOP = 22; // room for a value over the tallest bar
const BOTTOM = 18; // room for a value under the deepest surplus
const RIGHT = 44; // room for the plan label
const MAX_BAR = 22;
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const dayName = (date: string) => fromISODate(date).toDateString().slice(0, 3);

/** A bar from the zero line to `to`, rounded only at its data end (4px), square on the zero line. */
function bar(x: number, zero: number, to: number, w: number) {
  const up = to < zero;
  const r = Math.min(4, w / 2, Math.abs(zero - to));
  return up
    ? `M${x} ${zero}V${to + r}Q${x} ${to} ${x + r} ${to}H${x + w - r}Q${x + w} ${to} ${x + w} ${to + r}V${zero}Z`
    : `M${x} ${zero}V${to - r}Q${x} ${to} ${x + r} ${to}H${x + w - r}Q${x + w} ${to} ${x + w} ${to - r}V${zero}Z`;
}

function readout(d: DeficitDay): string {
  const name = d.isToday ? 'Today' : dayName(d.date);
  if (d.deficit === null) return `${name}: not logged`;
  if (d.partial) return `${name}: ${formatInt(d.deficit)} so far`;
  const word = balanceWord(d.deficit);
  return `${name}: ${word === 'Even' ? 'even' : `${word.toLowerCase()} ${formatInt(Math.abs(d.deficit))}`}`;
}

/**
 * The last 7 days' energy balance: bars rise for a deficit (cool) and drop for
 * a surplus (warm) from the zero line; the dashed line is what eating exactly
 * your budget would have given. Today shows once you finish it. Tap a day to read it.
 */
export function DeficitBars({ days }: { days: DeficitDay[] }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  // Until you tap a day, the latest finished one is read out (the data may arrive after the first draw).
  const lastDone = days.map((d, i) => (d.deficit !== null && !d.partial ? i : -1)).filter((i) => i >= 0);
  const [tapped, setPicked] = useState<number | null>(null);
  const picked = tapped ?? lastDone[lastDone.length - 1] ?? days.length - 1;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const shown = days.map((d) => (d.deficit !== null && !d.partial ? d.deficit : null));
  const values = [...shown.filter((v): v is number => v !== null), ...days.map((d) => d.planned)];
  const hi = Math.max(0, ...values) * 1.1 || 100;
  const lo = Math.min(0, ...values) * 1.1;
  const plotW = Math.max(0, width - RIGHT);
  const base = HEIGHT - LABELS - (lo < 0 ? BOTTOM : 0);
  const y = (v: number) => TOP + ((hi - v) / (hi - lo || 1)) * (base - TOP);
  const zero = y(0);
  const slot = plotW / days.length;
  const barW = Math.min(MAX_BAR, slot * 0.55);
  // What your budget would give, as a step line: a check-in mid-week moves it.
  const planPath = days.map((d, i) => `${i ? 'L' : 'M'}${(i * slot).toFixed(1)} ${y(d.planned).toFixed(1)}H${((i + 1) * slot).toFixed(1)}`).join('');
  const lastPlan = days[days.length - 1]?.planned ?? 0;
  const pickedDay = days[picked];

  return (
    <View>
      <View
        onLayout={onLayout}
        style={{ height: HEIGHT }}
        accessible
        accessibilityLabel={`Deficit, last 7 days: ${days.map(readout).join('; ')}. On budget each day would be about ${formatInt(lastPlan)}.`}>
        {width > 0 ? (
          <>
            <Svg width={width} height={HEIGHT}>
              {shown.map((v, i) =>
                v === null || Math.abs(y(v) - zero) < 0.5 ? null : (
                  <Path key={days[i].date} d={bar(i * slot + (slot - barW) / 2, zero, y(v), barW)} fill={v >= 0 ? colors.deficit : colors.surplus} />
                ),
              )}
              {/* The zero line: eating exactly what you burned. */}
              <Path d={`M0 ${zero + 0.5}H${plotW}`} stroke={colors.hairlineStrong} strokeWidth={1} />
              <Path d={planPath} stroke={colors.textSecondary} strokeWidth={1} strokeDasharray="3 3" fill="none" />
            </Svg>
            <Text variant="label" style={[styles.sideLabel, { top: y(lastPlan) - 7, left: plotW + 6 }]} tabular>
              {formatInt(lastPlan)}
            </Text>
            {days.map((d, i) => {
              const v = shown[i];
              return (
                <PressableScale
                  key={d.date}
                  accessible={false}
                  haptic="tick"
                  pressedScale={0.97}
                  ripple={null}
                  onPress={() => setPicked(i)}
                  style={[styles.hit, { left: i * slot, width: slot }]}>
                  {i === picked && v !== null ? (
                    <Text variant="smallStrong" tabular style={[styles.value, { top: v >= 0 ? y(v) - 19 : y(v) + 3 }]}>
                      {formatInt(Math.abs(v))}
                    </Text>
                  ) : null}
                  <Text variant="label" style={[styles.day, d.isToday && { color: colors.text }]}>
                    {LETTERS[fromISODate(d.date).getDay()]}
                  </Text>
                </PressableScale>
              );
            })}
          </>
        ) : null}
      </View>
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.deficit }]} />
          <Text variant="caption" color="textSecondary">
            Deficit
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.surplus }]} />
          <Text variant="caption" color="textSecondary">
            Surplus
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dash, { borderColor: colors.textSecondary }]} />
          <Text variant="caption" color="textSecondary">
            On budget
          </Text>
        </View>
        {pickedDay ? (
          <Text variant="caption" color="textTertiary" style={styles.pickedNote} tabular>
            {readout(pickedDay)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { position: 'absolute', top: 0, height: HEIGHT, alignItems: 'center' },
  value: { position: 'absolute' },
  day: { position: 'absolute', bottom: 2 },
  sideLabel: { position: 'absolute' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  dash: { width: 14, height: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  pickedNote: { marginLeft: 'auto' },
});
