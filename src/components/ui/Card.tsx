import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

/**
 * A raised surface. Use it only for things the user acts on as a group;
 * everything else sits directly on the background.
 */
export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface1, borderColor: colors.hairline },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
