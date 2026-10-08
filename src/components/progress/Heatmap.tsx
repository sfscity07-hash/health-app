import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { HeatLevel, HeatWeek } from '@/features/progress/logic';
import { fromISODate } from '@/lib/dates';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const GAP = 3;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 13 weeks of days, one column a week: grey not logged, light logged, full colour finished. */
export function Heatmap({ weeks, logged, finished }: { weeks: HeatWeek[]; logged: number; finished: number }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const cell = width > 0 ? (width - GAP * (weeks.length - 1)) / weeks.length : 0;

  const fill = (level: HeatLevel) => {
    switch (level) {
      case 'finished':
        return { backgroundColor: colors.accent };
      case 'logged':
        return { backgroundColor: colors.accent, opacity: 0.42 };
      case 'future':
        return { borderWidth: 1, borderColor: colors.hairline };
      default:
        return { backgroundColor: colors.surface3 };
    }
  };

  // A month name over the first week that starts in it.
  const months = weeks.map((w, i) => {
    const m = fromISODate(w.monday).getMonth();
    const prev = i > 0 ? fromISODate(weeks[i - 1].monday).getMonth() : -1;
    return m !== prev ? MONTHS[m] : null;
  });

  return (
    <View style={styles.root}>
      <View
        onLayout={onLayout}
        accessible
        accessibilityLabel={`Last ${weeks.length} weeks: ${logged} days logged, ${finished} of them finished.`}>
        <View style={[styles.months, { height: 14 }]}>
          {width > 0
            ? months.map((m, i) =>
                m ? (
                  <Text key={i} variant="label" style={[styles.month, { left: i * (cell + GAP) }]}>
                    {m}
                  </Text>
                ) : null,
              )
            : null}
        </View>
        {width > 0 ? (
          <View style={styles.grid}>
            {weeks.map((w) => (
              <View key={w.monday} style={{ gap: GAP }}>
                {w.days.map((d) => (
                  <View key={d.date} style={[{ width: cell, height: cell, borderRadius: 3 }, fill(d.level)]} />
                ))}
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {(['none', 'logged', 'finished'] as const).map((l) => (
          <View key={l} style={styles.legendItem}>
            <View style={[styles.swatch, fill(l)]} />
            <Text variant="caption" color="textSecondary">
              {l === 'none' ? 'Not logged' : l === 'logged' ? 'Logged' : 'Finished'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  months: { position: 'relative', marginBottom: 4 },
  month: { position: 'absolute', top: 0 },
  grid: { flexDirection: 'row', gap: GAP },
  legend: { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
});
