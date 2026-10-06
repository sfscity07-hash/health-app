import { StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale, type PressableScaleProps } from '@/components/ui/PressableScale';
import { useTheme } from '@/theme/theme';

type IconButtonProps = Omit<PressableScaleProps, 'children' | 'style'> & {
  icon: IconName;
  /** Read by screen readers, e.g. "Back to results". */
  label: string;
  size?: number;
};

export function IconButton({ icon, label, size = 40, ...rest }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      haptic="tick"
      pressedScale={0.92}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surface1,
          borderColor: colors.hairline,
        },
      ]}
      {...rest}>
      <Icon name={icon} size={Math.round(size * 0.48)} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
