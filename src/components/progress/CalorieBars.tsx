import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import type { CalorieDay } from '@/features/progress/logic';
import { fromISODate } from '@/lib/dates';
import { formatInt } from '@/lib/format';
import { useTheme } from '@/theme/theme';

const HEIGHT = 150;
const LABELS = 22; // day letters under the baseline
const TOP = 22; // room for a value over the tallest bar
const RIGHT = 44; // room for the budget label
const MAX_BAR = 22;
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function column(x: number, y: number, w: number, base: number) {
  const r = Math.min(4, w / 2, Math.max(0, base - y));
  return `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${base}Z`;
}

/**
 * The last 7 days against your budget. Today is in the accent colour,
 * days more than 5% over are orange, the rest grey; the dashed line is the
 * budget each day had. Tap a bar to read it.
 */
export function CalorieBars({ days }: { days: CalorieDay[] }) {
  const { colors, scheme } = useTheme();
  const grey = scheme === 'dark' ? colors.textTertiary : colors.textSecondary;
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState(days.length - 1);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const plotW = Math.max(0, width - RIGHT);
  const base = HEIGHT - LABELS;
  const max = Math.max(...days.map((d) => Math.max(d.kcal, d.budget)), 1) * 1.08;
  const y = (v: number) => base - (v / max) * (base - TOP);
  const slot = plotW / days.length;
  const barW = Math.min(MAX_BAR, slot * 0.55);
  // The budget as a step line: one level per day, so a check-in mid-week shows.
  const budgetPath = days.map((d, i) => `${i ? 'L' : 'M'}${(i * slot).toFixed(1)} ${y(d.budget).toFixed(1)}H${((i + 1) * slot).toFixed(1)}`).join('');
  const lastBudget = days[days.length - 1]?.budget ?? 0;
  const pickedDay = days[picked];

  return (
    <View>
      <View
        onLayout={onLayout}
        style={{ height: HEIGHT }}
        accessible
        accessibilityLabel={`Calories, last 7 days: ${days
          .map((d) => `${fromISODate(d.date).toDateString().slice(0, 3)} ${formatInt(d.kcal)} of ${formatInt(d.budget)}${d.over ? ', over' : ''}`)
          .join('; ')}.`}>
        {width > 0 ? (
          <>
            <Svg width={width} height={HEIGHT}>
              <Path d={`M0 ${base + 0.5}H${plotW}`} stroke={colors.hairlineStrong} strokeWidth={1} />
              {days.map((d, i) => (
                <Path
                  key={d.date}
                  d={column(i * slot + (slot - barW) / 2, y(d.kcal), barW, base)}
                  fill={d.isToday ? colors.accent : d.over ? colors.warn : grey}
                />
              ))}
              <Path d={budgetPath} stroke={colors.textSecondary} strokeWidth={1} strokeDasharray="3 3" fill="none" />
            </Svg>
            <Text variant="label" style={[styles.budgetLabel, { top: y(lastBudget) - 7, left: plotW + 6 }]} tabular>
              {formatInt(lastBudget)}
            </Text>
            {days.map((d, i) => (
              <PressableScale
                key={d.date}
                accessible={false}
                haptic="tick"
                pressedScale={0.97}
                ripple={null}
                onPress={() => setPicked(i)}
                style={[styles.hit, { left: i * slot, width: slot }]}>
                {i === picked && d.kcal > 0 ? (
                  <Text variant="smallStrong" tabular style={[styles.value, { top: y(d.kcal) - 19 }]}>
                    {formatInt(d.kcal)}
                  </Text>
                ) : null}
                <Text variant="label" style={[styles.day, d.isToday && { color: colors.text }]}>
                  {LETTERS[fromISODate(d.date).getDay()]}
                </Text>
              </PressableScale>
            ))}
          </>
        ) : null}
      </View>
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.accent }]} />
          <Text variant="caption" color="textSecondary">
            Today
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.warn }]} />
          <Text variant="caption" color="textSecondary">
            Over budget
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dash, { borderColor: colors.textSecondary }]} />
          <Text variant="caption" color="textSecondary">
            Budget
          </Text>
        </View>
        {pickedDay && !pickedDay.isToday ? (
          <Text variant="caption" color="textTertiary" style={styles.pickedNote} tabular>
            {fromISODate(pickedDay.date).toDateString().slice(0, 3)}: {formatInt(pickedDay.kcal)} / {formatInt(pickedDay.budget)}
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
  budgetLabel: { position: 'absolute' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  dash: { width: 14, height: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  pickedNote: { marginLeft: 'auto' },
});
