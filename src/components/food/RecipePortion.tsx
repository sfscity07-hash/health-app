import { StyleSheet, View } from 'react-native';

import { CompositionBar, PartDot } from '@/components/food/RecipeMarks';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useRecipe } from '@/features/recipes/api';
import { composition, finishedWeight, rawWeight } from '@/features/recipes/logic';
import { formatInt } from '@/lib/format';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

const g = (n: number) => (n > 0 && n < 10 ? n.toFixed(1) : formatInt(n));

/**
 * What's in the amount you're about to log: each ingredient's grams and
 * calories in this portion, biggest first. Follows the ruler as you drag it.
 */
export function RecipePortion({ id, grams, kcal }: { id: string; grams: number; kcal: number }) {
  const { colors } = useTheme();
  const recipe = useRecipe(id);
  if (!recipe.data || recipe.data.items.length === 0) return null;

  const d = recipe.data;
  const batch = finishedWeight(d);
  if (!(batch > 0)) return null;
  const parts = composition(d.items, grams / batch, 5);
  const raw = rawWeight(d.items);
  const lost = d.finalWeight !== null && raw - d.finalWeight >= 1 ? raw - d.finalWeight : 0;
  const summary = parts.map((p) => `${p.name}${p.grams !== null ? ` ${g(p.grams)} grams` : ''}, ${formatInt(p.share * kcal)} calories`).join('; ');

  return (
    <Card style={styles.card} accessible accessibilityLabel={`What's in ${g(grams)} grams: ${summary}.`}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: colors.recipeSoft }]}>
          <Icon name="pot" size={14} color="recipe" strokeWidth={2} />
        </View>
        <Text variant="smallStrong" style={styles.flex}>
          What’s in {g(grams)} g
        </Text>
        <Text variant="label">kcal</Text>
      </View>
      <CompositionBar parts={parts} />
      <View>
        {parts.map((p, i) => (
          <View key={p.key} style={[styles.row, i > 0 && { borderTopColor: colors.hairline, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
            <PartDot rank={p.rank} />
            <Text variant="small" numberOfLines={1} style={styles.flex} color={p.rank === null ? 'textSecondary' : 'text'}>
              {p.name}
            </Text>
            <Text variant="small" color="textSecondary" tabular style={styles.grams}>
              {p.grams !== null ? `${g(p.grams)} g` : '–'}
            </Text>
            <Text variant="smallStrong" tabular style={styles.kcal}>
              {formatInt(p.share * kcal)}
            </Text>
          </View>
        ))}
      </View>
      {lost > 0 ? (
        <Text variant="caption" color="textTertiary">
          Amounts are as they went in; the batch lost {formatInt(lost)} g of water cooking.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: { width: 26, height: 26, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, paddingVertical: 9 },
  grams: { minWidth: 52, textAlign: 'right' },
  kcal: { minWidth: 40, textAlign: 'right' },
});
