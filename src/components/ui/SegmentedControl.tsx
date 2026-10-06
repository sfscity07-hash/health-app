import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  options: Option<T>[];
  /** null shows no option selected yet. */
  value: T | null;
  onChange: (value: T) => void;
  /** Read by screen readers, e.g. "Theme". */
  label: string;
};

export function SegmentedControl<T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.track, { backgroundColor: colors.surface2 }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            haptic={selected ? 'none' : 'tick'}
            hapticOn="pressIn"
            pressedScale={0.96}
            onPress={() => {
              if (!selected) onChange(o.value);
            }}
            style={[styles.option, selected && { backgroundColor: colors.segmentOn }]}>
            <Text variant="smallStrong" color={selected ? 'text' : 'textSecondary'}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 3, borderRadius: radius.md, gap: 3 },
  option: { flex: 1, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
