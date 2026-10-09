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
      style={[styles.banner, { backgroundColor: colors.recipeSoft }]}>
      <View style={[styles.badge, { backgroundColor: colors.recipe }]}>
        <Icon name="pot" size={17} color="bg" strokeWidth={2.1} />
      </View>
      <View style={styles.text}>
        <Text variant="smallStrong">
          <Text variant="smallStrong" color="recipe">
            Recipe
          </Text>{' '}
          · {count} ingredient{count === 1 ? '' : 's'}
        </Text>
        <Text variant="caption" color="textSecondary">
          Change amounts, swap an ingredient, or save a new version
        </Text>
      </View>
      <View style={[styles.edit, { borderColor: colors.recipe }]}>
        <Text variant="smallStrong" color="recipe">
          Edit
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg },
  badge: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  edit: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: space.md, paddingVertical: 5 },
});
