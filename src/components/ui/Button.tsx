import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale, type PressableScaleProps } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { radius, space, type ColorName } from '@/theme/tokens';

type Variant = 'primary' | 'inverse' | 'secondary' | 'ghost';

type ButtonProps = Omit<PressableScaleProps, 'children' | 'style'> & {
  label: string;
  /** Secondary text on the right, e.g. "309 kcal". */
  trailing?: string;
  icon?: IconName;
  variant?: Variant;
  /** Shows a spinner and blocks presses while something is saving. */
  loading?: boolean;
};

const looks: Record<Variant, { bg: ColorName | null; fg: ColorName; ripple: ColorName }> = {
  primary: { bg: 'accent', fg: 'accentInk', ripple: 'rippleOnAccent' },
  inverse: { bg: 'text', fg: 'bg', ripple: 'rippleOnAccent' },
  secondary: { bg: 'surface2', fg: 'text', ripple: 'ripple' },
  ghost: { bg: null, fg: 'accent', ripple: 'ripple' },
};

export function Button({ label, trailing, icon, variant = 'primary', disabled, loading, ...rest }: ButtonProps) {
  const { colors } = useTheme();
  const look = looks[variant];
  const blocked = Boolean(disabled || loading);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: Boolean(loading) }}
      disabled={blocked}
      haptic="tap"
      ripple={look.ripple}
      style={[
        styles.base,
        variant === 'ghost' ? styles.ghost : styles.filled,
        trailing ? styles.spread : null,
        { backgroundColor: look.bg ? colors[look.bg] : 'transparent' },
        disabled && !loading ? styles.disabled : null,
      ]}
      {...rest}>
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={colors[look.fg]} />
        ) : icon ? (
          <Icon name={icon} size={18} color={look.fg} strokeWidth={2.2} />
        ) : null}
        <Text variant="bodyStrong" color={look.fg}>
          {label}
        </Text>
      </View>
      {trailing ? (
        <Text variant="body" color={look.fg} tabular style={styles.trailing}>
          {trailing}
        </Text>
      ) : null}
    </PressableScale>
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
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  spread: { justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  trailing: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
