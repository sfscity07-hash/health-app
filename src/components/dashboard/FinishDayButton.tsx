import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

type FinishDayButtonProps = {
  closed: boolean;
  /** "today" or "yesterday". */
  dayWord: string;
  streak: number;
  best: number;
  busy?: boolean;
  onPress: () => void;
};

/** The nightly ritual: closes the day, extends the streak, fills the day's ring. */
export const FinishDayButton = forwardRef<View, FinishDayButtonProps>(function FinishDayButton(
  { closed, dayWord, streak, best, busy, onPress },
  ref,
) {
  const { colors } = useTheme();
  const toBest = best - streak;
  return (
    <View ref={ref} collapsable={false}>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ disabled: closed || busy }}
        disabled={closed || busy}
        haptic="none"
        pressedScale={0.98}
        ripple="rippleOnAccent"
        onPress={onPress}
        style={[
          styles.button,
          closed
            ? { backgroundColor: colors.surface1, borderColor: colors.hairline, borderWidth: StyleSheet.hairlineWidth * 2 }
            : { backgroundColor: colors.text },
        ]}>
        <View style={styles.text}>
          <Text variant="bodyStrong" color={closed ? 'text' : 'bg'}>
            {closed ? 'Day finished' : `Finish ${dayWord}`}
          </Text>
          <Text variant="caption" color={closed ? 'textSecondary' : 'bg'} style={!closed && styles.dim}>
            {closed
              ? `Streak ${streak}${toBest > 0 ? ` · ${toBest} to your best` : streak > 1 ? ' · your best yet' : ''}`
              : `Close the day to make your streak ${streak + 1}`}
          </Text>
        </View>
        <View style={[styles.icon, { backgroundColor: closed ? colors.good : colors.accent }]}>
          <Icon name={closed ? 'check' : 'arrowRight'} size={18} color={closed ? 'bg' : 'accentInk'} strokeWidth={2.4} />
        </View>
      </PressableScale>
    </View>
  );
});

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.md + 1,
    paddingLeft: space.lg + 2,
    paddingRight: space.md + 1,
    borderRadius: radius.xl - 2,
  },
  text: { flex: 1, gap: 1 },
  dim: { opacity: 0.62 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
