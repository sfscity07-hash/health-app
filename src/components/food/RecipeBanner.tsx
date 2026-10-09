import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

/** On a recipe's food screen: what it is, and a way to change what went in. */
export function RecipeBanner({ count, onEdit }: { count: number; onEdit: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Recipe with ${count} ingredient${count === 1 ? '' : 's'}. Edit recipe.`}
      haptic="tap"
      pressedScale={0.98}
      onPress={onEdit}
      style={[styles.banner, { backgroundColor: colors.surface1, borderColor: colors.hairline }]}>
      <Icon name="fork" size={16} color="accent" />
      <View style={styles.text}>
        <Text variant="smallStrong">Recipe · {count} ingredient{count === 1 ? '' : 's'}</Text>
        <Text variant="caption" color="textSecondary">
          Change amounts, swap an ingredient, or save a new version
        </Text>
      </View>
      <Text variant="smallStrong" color="accent">
        Edit
      </Text>
      <Icon name="chevronRight" size={15} color="accent" />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  text: { flex: 1, gap: 1 },
});
