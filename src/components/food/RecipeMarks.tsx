import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import type { Part } from '@/features/recipes/logic';
import { useTheme } from '@/theme/theme';
import type { ThemeColors } from '@/theme/tokens';

/**
 * Recipes have their own color (orchid) and mark (a lidded pot), so a dish
 * made of other foods never looks like a plain food in a list.
 */

/** The recipe color, fading for each smaller ingredient; the grouped rest are grey. */
const SHADES = [1, 0.7, 0.48, 0.32, 0.2];
export function partStyle(rank: number | null, colors: ThemeColors): ViewStyle {
  return rank === null || rank >= SHADES.length ? { backgroundColor: colors.bar } : { backgroundColor: colors.recipe, opacity: SHADES[rank] };
}

/** The "RECIPE" pill on food rows. */
export function RecipeTag() {
  const { colors } = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: colors.recipeSoft }]}>
      <Icon name="pot" size={10} color="recipe" strokeWidth={2.2} />
      <Text variant="label" color="recipe" style={styles.tagText}>
        Recipe
      </Text>
    </View>
  );
}

/** The pot before a logged recipe's name. */
export function RecipeGlyph({ size = 13 }: { size?: number }) {
  return <Icon name="pot" size={size} color="recipe" strokeWidth={2} />;
}

/** Where the calories come from, one segment per ingredient, biggest first. */
export function CompositionBar({ parts, height = 8 }: { parts: Part[]; height?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { height, borderRadius: height / 2 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {parts
        .filter((p) => p.share > 0.004)
        .map((p) => (
          <View key={p.key} style={[{ flex: p.share }, partStyle(p.rank, colors)]} />
        ))}
    </View>
  );
}

/** A legend dot matching a segment of the bar. */
export function PartDot({ rank, size = 8 }: { rank: number | null; size?: number }) {
  const { colors } = useTheme();
  return <View style={[{ width: size, height: size, borderRadius: size / 2 }, partStyle(rank, colors)]} />;
}

const styles = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 4, paddingLeft: 4, paddingRight: 5, paddingVertical: 1.5 },
  tagText: { fontSize: 8.5, lineHeight: 11, letterSpacing: 0.5 },
  bar: { flexDirection: 'row', gap: 2, overflow: 'hidden' },
});
