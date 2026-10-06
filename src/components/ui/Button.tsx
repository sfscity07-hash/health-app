import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { tap } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { radius, space, type ColorName } from '@/theme/tokens';

type Variant = 'primary' | 'inverse' | 'secondary' | 'ghost';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  /** Secondary text on the right, e.g. "309 kcal". */
  trailing?: string;
  icon?: IconName;
  variant?: Variant;
};

const looks: Record<Variant, { bg: ColorName | null; fg: ColorName }> = {
  primary: { bg: 'accent', fg: 'accentInk' },
  inverse: { bg: 'text', fg: 'bg' },
  secondary: { bg: 'surface2', fg: 'text' },
  ghost: { bg: null, fg: 'accent' },
};

export function Button({ label, trailing, icon, variant = 'primary', disabled, onPress, ...rest }: ButtonProps) {
  const { colors } = useTheme();
  const look = looks[variant];
  const spread = Boolean(trailing);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={(e) => {
        tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        variant === 'ghost' ? styles.ghost : styles.filled,
        spread && styles.spread,
        { backgroundColor: look.bg ? colors[look.bg] : 'transparent' },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...rest}>
      <View style={styles.row}>
        {icon ? <Icon name={icon} size={18} color={look.fg} strokeWidth={2.2} /> : null}
        <Text variant="bodyStrong" color={look.fg}>
          {label}
        </Text>
      </View>
      {trailing ? (
        <Text variant="body" color={look.fg} tabular style={styles.trailing}>
          {trailing}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: {
    minHeight: 56,
    borderRadius: radius.lg + 3,
    paddingHorizontal: space.xl,
  },
  ghost: {
    minHeight: 44,
    paddingHorizontal: space.sm,
  },
  spread: { justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  trailing: { opacity: 0.7 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  disabled: { opacity: 0.4 },
});
