import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { tick } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';

type IconButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  icon: IconName;
  /** Read by screen readers, e.g. "Back to results". */
  label: string;
  size?: number;
};

export function IconButton({ icon, label, size = 40, onPress, ...rest }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={(e) => {
        tick();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surface1,
          borderColor: colors.hairline,
        },
        pressed && styles.pressed,
      ]}
      {...rest}>
      <Icon name={icon} size={Math.round(size * 0.48)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  pressed: { opacity: 0.7 },
});
