import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { formatShortDate, fromISODate } from '@/lib/dates';
import { formatInt } from '@/lib/format';
import { useTheme } from '@/theme/theme';

export type WeekBar = { week: string; kcal: number };

const HEIGHT = 132;
const LABEL_SPACE = 22;
const MAX_BAR = 24;
const RADIUS = 4;

/** A column with a 4px rounded top and a square foot on the baseline. */
function columnPath(x: number, y: number, w: number, base: number) {
  const r = Math.min(RADIUS, w / 2, base - y);
  return `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${base}Z`;
}

/**
 * Expenditure for the last few check-ins. The newest week is in the accent
 * colour and the earlier ones are grey context; tap a bar to read its value.
 * Bars start at zero, so week-to-week moves look as small as they really are.
 */
export function ExpenditureBars({ bars }: { bars: WeekBar[] }) {
  const { colors, scheme } = useTheme();
  const grey = scheme === 'dark' ? colors.textTertiary : colors.textSecondary;
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState(bars.length - 1);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const max = Math.max(...bars.map((b) => b.kcal), 1);
  const base = HEIGHT - LABEL_SPACE;
  const top = 20; // room for the value on the tallest cap
  const slot = bars.length ? width / bars.length : 0;
  const barW = Math.min(MAX_BAR, slot * 0.5);
  const y = (kcal: number) => base - (kcal / max) * (base - top);
  const label = (b: WeekBar) => formatShortDate(fromISODate(b.week));

  return (
    <View
      onLayout={onLayout}
      style={styles.root}
      accessible
      accessibilityLabel={`Expenditure by week: ${bars.map((b) => `week of ${label(b)}, ${formatInt(b.kcal)} kcal`).join('; ')}.`}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          <Line x1={0} x2={width} y1={base + 0.5} y2={base + 0.5} stroke={colors.hairlineStrong} strokeWidth={1} />
          {bars.map((b, i) => {
            const x = i * slot + (slot - barW) / 2;
            const isNow = i === bars.length - 1;
            return (
              <Path
                key={b.week}
                d={columnPath(x, y(b.kcal), barW, base)}
                fill={isNow ? colors.accent : grey}
              />
            );
          })}
        </Svg>
      ) : null}
      {/* Labels and hit areas sit over the drawing: the value on the picked bar's cap, the week under each bar. */}
      {width > 0
        ? bars.map((b, i) => (
            <PressableScale
              key={b.week}
              accessible={false}
              haptic="tick"
              pressedScale={0.97}
              ripple={null}
              onPress={() => setPicked(i)}
              style={[styles.hit, { left: i * slot, width: slot }]}>
              {i === picked ? (
                <Text variant="smallStrong" tabular style={[styles.value, { top: y(b.kcal) - 19 }]}>
                  {formatInt(b.kcal)}
                </Text>
              ) : null}
              <Text variant="label" style={[styles.week, i === bars.length - 1 && { color: colors.text }]}>
                {i === bars.length - 1 ? 'Now' : label(b)}
              </Text>
            </PressableScale>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: HEIGHT },
  hit: { position: 'absolute', top: 0, height: HEIGHT, alignItems: 'center' },
  value: { position: 'absolute' },
  week: { position: 'absolute', bottom: 0 },
});
