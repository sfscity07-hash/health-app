import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

type ChipProps = {
  label: string;
  selected?: boolean;
  icon?: IconName;
  onPress: () => void;
  /** Read by screen readers instead of the label, e.g. "Add a unit". */
  accessibilityLabel?: string;
};

/** A small pill you tap to pick something, like a unit. */
export function Chip({ label, selected, icon, onPress, accessibilityLabel }: ChipProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole={icon ? 'button' : 'radio'}
      accessibilityState={icon ? undefined : { checked: Boolean(selected) }}
      accessibilityLabel={accessibilityLabel ?? label}
      haptic={selected ? 'none' : 'tick'}
      hapticOn="pressIn"
      pressedScale={0.94}
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.accentSoft, borderColor: colors.accent }
          : { backgroundColor: colors.surface2, borderColor: icon ? colors.hairlineStrong : 'transparent' },
      ]}>
      {icon ? <Icon name={icon} size={14} color="accent" strokeWidth={2.4} /> : null}
      <Text variant="smallStrong" color={selected ? 'accent' : icon ? 'accent' : 'textSecondary'}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Chips that wrap onto more lines, or scroll sideways in one line with `scroll`. */
export function ChipGroup({ children, scroll, label }: { children: ReactNode; scroll?: boolean; label: string }) {
  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        contentContainerStyle={styles.row}>
        {children}
      </ScrollView>
    );
  }
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.wrap}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    borderWidth: 1,
  },
  row: { flexDirection: 'row', gap: space.xs + 2, paddingRight: space.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2 },
});
