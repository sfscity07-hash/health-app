import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import type { FoodLogEntry } from '@/features/dashboard/api';
import { formatInt } from '@/lib/format';
import { MEAL_LABEL, type Meal } from '@/lib/meals';
import { describeLogged } from '@/lib/portion';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const grams = (g: number) => (g > 0 && g < 10 ? g.toFixed(1) : String(Math.round(g)));

type MealCardProps = {
  meal: Meal;
  entries: FoodLogEntry[];
  onAdd: () => void;
  onPressEntry: (entry: FoodLogEntry) => void;
};

/** One meal on the Food log: its foods with calories and macros, and a way to add more. */
export function MealCard({ meal, entries, onAdd, onPressEntry }: MealCardProps) {
  const { colors } = useTheme();
  const kcal = entries.reduce((s, e) => s + e.kcal, 0);
  const protein = entries.reduce((s, e) => s + e.protein_g, 0);
  const label = MEAL_LABEL[meal];

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text variant="heading">{label}</Text>
          <Text variant="caption" color="textSecondary" tabular>
            {entries.length === 0 ? 'Nothing yet' : `${formatInt(kcal)} kcal · ${Math.round(protein)} g protein`}
          </Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Add to ${label.toLowerCase()}`}
          haptic="tap"
          pressedScale={0.9}
          hitSlop={6}
          onPress={onAdd}
          style={[styles.add, { backgroundColor: colors.accentSoft }]}>
          <Icon name="plus" size={17} color="accent" strokeWidth={2.4} />
        </PressableScale>
      </View>

      {entries.map((e) => (
        <PressableScale
          key={e.id}
          accessibilityRole="button"
          accessibilityLabel={`${e.name}, ${formatInt(e.kcal)} calories. Tap to edit.`}
          pressedScale={0.985}
          onPress={() => onPressEntry(e)}
          style={[styles.entry, { borderTopColor: colors.hairline }]}>
          <View style={styles.entryText}>
            <Text variant="body" numberOfLines={1}>
              {e.name}
            </Text>
            <Text variant="caption" color="textTertiary" numberOfLines={1}>
              {e.unit === 'serving' && e.quantity === 1 ? 'Quick add' : describeLogged(e.quantity, e.unit, null)}
              {e.brand ? ` · ${e.brand}` : ''}
            </Text>
          </View>
          <View style={styles.entryNums}>
            <Text variant="smallStrong" tabular>
              {formatInt(e.kcal)}
            </Text>
            <Text variant="caption" color="textTertiary" tabular>
              <Text variant="caption" color="protein">
                P
              </Text>{' '}
              {grams(e.protein_g)}{' '}
              <Text variant="caption" color="carbs">
                C
              </Text>{' '}
              {grams(e.carbs_g)}{' '}
              <Text variant="caption" color="fat">
                F
              </Text>{' '}
              {grams(e.fat_g)}
            </Text>
          </View>
        </PressableScale>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.sm },
  headText: { flex: 1, gap: 1 },
  add: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  entryText: { flex: 1, minWidth: 0, gap: 2 },
  entryNums: { alignItems: 'flex-end', gap: 2 },
});
