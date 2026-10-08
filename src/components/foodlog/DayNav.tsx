import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { addDays, dayName, formatShortDate, fromISODate, toISODate } from '@/lib/dates';
import { useTheme } from '@/theme/theme';

/** "Today", "Yesterday", "Sunday" within the last week, else "Sep 28". */
export function relativeDay(date: string, today: string): string {
  if (date === today) return 'Today';
  const d = fromISODate(date);
  const t = fromISODate(today);
  if (date === toISODate(addDays(t, -1))) return 'Yesterday';
  if (date === toISODate(addDays(t, 1))) return 'Tomorrow';
  if (date > toISODate(addDays(t, -7)) && date < today) return dayName(d);
  return formatShortDate(d, t);
}

function Arrow({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      haptic="tick"
      hapticOn="pressIn"
      pressedScale={0.88}
      hitSlop={6}
      onPress={onPress}
      style={[styles.arrow, disabled && styles.off]}>
      <Icon name={icon} size={17} strokeWidth={2.2} />
    </PressableScale>
  );
}

/** Step a day back or forward, up to `max` (today unless you're copying ahead). */
export function DayNav({ date, today, onChange, max = today }: { date: string; today: string; onChange: (date: string) => void; max?: string }) {
  const { colors } = useTheme();
  const step = (n: number) => onChange(toISODate(addDays(fromISODate(date), n)));
  const atToday = date >= max;
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface1, borderColor: colors.hairline }]}>
      <Arrow icon="chevronLeft" label="Previous day" onPress={() => step(-1)} />
      <Text variant="smallStrong" style={styles.label} align="center" numberOfLines={1}>
        {relativeDay(date, today)}
      </Text>
      <Arrow icon="chevronRight" label="Next day" disabled={atToday} onPress={() => step(1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 2,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  label: { minWidth: 74 },
  arrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
});
