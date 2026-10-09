import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

type StepperProps = {
  label: string;
  /** The value as shown, e.g. "10.0 km/h". */
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minDisabled?: boolean;
  maxDisabled?: boolean;
  hint?: string;
};

/** A labelled value with − and + either side. */
export function Stepper({ label, value, onMinus, onPlus, minDisabled, maxDisabled, hint }: StepperProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface1, borderColor: colors.hairline }]}>
      <View style={styles.text}>
        <Text variant="caption" color="textSecondary">
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" color="textTertiary">
            {hint}
          </Text>
        ) : null}
      </View>
      <IconButton icon="minus" label={`Less ${label.toLowerCase()}`} size={34} onPress={onMinus} disabled={minDisabled} />
      <Text variant="bodyStrong" tabular style={styles.value} accessibilityLabel={`${label}: ${value}`}>
        {value}
      </Text>
      <IconButton icon="plus" label={`More ${label.toLowerCase()}`} size={34} onPress={onPlus} disabled={maxDisabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  text: { flex: 1, gap: 1 },
  value: { minWidth: 84, textAlign: 'center' },
});
