import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/theme/theme';
import { typeScale, type ColorName, type TypeVariant } from '@/theme/tokens';

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  color?: ColorName;
  /** Equal-width digits so numbers don't jitter as they change. */
  tabular?: boolean;
  align?: 'left' | 'center' | 'right';
};

const defaultColor: Partial<Record<TypeVariant, ColorName>> = {
  caption: 'textSecondary',
  label: 'textTertiary',
};

export function Text({ variant = 'body', color, tabular, align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const resolved = color ?? defaultColor[variant] ?? 'text';
  return (
    <RNText
      style={[
        typeScale[variant],
        { color: colors[resolved] },
        variant === 'label' && { textTransform: 'uppercase' },
        tabular && { fontVariant: ['tabular-nums'] },
        align && { textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
}
