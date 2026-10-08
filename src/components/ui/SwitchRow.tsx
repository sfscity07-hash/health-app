import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { tick } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

type SwitchRowProps = {
  label: string;
  /** What on and off mean, under the label. */
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

/** A setting you turn on or off. The whole row is the switch. */
export function SwitchRow({ label, description, value, onChange }: SwitchRowProps) {
  const { colors } = useTheme();
  const flip = () => {
    tick();
    onChange(!value);
  };
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={flip}
      style={styles.row}>
      <View style={styles.text}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="caption" color="textSecondary">
            {description}
          </Text>
        ) : null}
      </View>
      {/* The row takes the touch (so a tap is never counted twice); the switch only shows the state. */}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Switch value={value} trackColor={{ false: colors.surface3, true: colors.accent }} thumbColor={Platform.OS === 'android' ? colors.text : undefined} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: 2 },
});
