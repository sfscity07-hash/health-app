import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';

export type WeekDay = {
  date: string;
  letter: string;
  dayOfMonth: number;
  /** Calories eaten / budget, 0–1. */
  fraction: number;
  closed: boolean;
  over: boolean;
  future: boolean;
  isToday: boolean;
};

const SIZE = 34;

/** Seven rings, Monday to Sunday. A finished day closes its ring; tap a day to look back at it. */
export function WeekRings({ days, selected, onSelect }: { days: WeekDay[]; selected: string; onSelect: (date: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {days.map((d) => {
        const isSelected = d.date === selected;
        const tone = d.over ? colors.warn : colors.accent;
        return (
          <PressableScale
            key={d.date}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected, disabled: d.future }}
            accessibilityLabel={`${d.letter} ${d.dayOfMonth}${d.closed ? ', finished' : ''}`}
            disabled={d.future}
            haptic="tick"
            hapticOn="pressIn"
            pressedScale={0.9}
            ripple={null}
            onPress={() => onSelect(d.date)}
            style={styles.day}>
            <Text variant="label" color={isSelected ? 'text' : 'textTertiary'} style={styles.letter}>
              {d.letter}
            </Text>
            <View style={styles.ring}>
              <ProgressRing
                size={SIZE}
                stroke={3}
                fraction={d.closed ? 1 : d.fraction}
                color={tone}
                trackColor={d.future ? colors.hairlineStrong : colors.surface3}
                dashed={d.future}
              />
              <View style={styles.center}>
                {d.closed ? (
                  <Icon name="check" size={14} color={d.over ? 'warn' : 'accent'} strokeWidth={2.6} />
                ) : (
                  <Text variant="caption" color={isSelected ? 'text' : 'textSecondary'} tabular style={isSelected && styles.bold}>
                    {d.dayOfMonth}
                  </Text>
                )}
              </View>
            </View>
            <View style={[styles.dot, { backgroundColor: isSelected ? colors.accent : 'transparent' }]} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -4 },
  day: { alignItems: 'center', gap: 6, paddingVertical: 2, paddingHorizontal: 2, borderRadius: 12 },
  letter: { fontSize: 10 },
  ring: { width: SIZE, height: SIZE },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '600' },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
