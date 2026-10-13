import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { MacroMix } from '@/components/food/MacroMix';
import { RecipeTag } from '@/components/food/RecipeMarks';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { formatInt } from '@/lib/format';
import { success, tap } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

type FoodRowProps = {
  name: string;
  detail: string;
  kcal: number;
  /** Grams of protein, carbs and fat in the amount shown, for the little split bar. */
  macros?: { p: number; c: number; f: number };
  /** Where it's from, e.g. "USDA". */
  tag?: string;
  /** A dish made of other foods: shown in the recipe color with a pot. */
  recipe?: boolean;
  favorite?: boolean;
  /** Opens the food so you can change the amount. */
  onPress: () => void;
  /**
   * Logs it straight away with the amount shown; `count` is how many you've
   * added from this row now. Return a way to take it back out and the + turns
   * into a − 1 + counter, so a second tap never adds silently.
   */
  onAdd: (count: number) => Undo | void;
  first?: boolean;
  /** Read out after the row; it's a food unless you say otherwise. */
  pressHint?: string;
};

type Undo = () => void;

/** One food in the logger: tap the row to adjust, tap + to log it as shown. */
export function FoodRow({ name, detail, kcal, macros, tag, recipe, favorite, onPress, onAdd, first, pressHint = 'Opens the food.' }: FoodRowProps) {
  const { colors } = useTheme();
  // Rows that can't take an add back just flash a check.
  const [added, setAdded] = useState(0);
  // One undo per add from this row, newest last.
  const [undos, setUndos] = useState<Undo[]>([]);
  const count = undos.length;
  const tint = recipe ? 'recipe' : 'accent';

  function add() {
    success();
    const undo = onAdd(count + 1);
    if (undo) setUndos((u) => [...u, undo]);
    else setAdded((n) => n + 1);
  }

  function remove() {
    const last = undos[undos.length - 1];
    if (!last) return;
    tap();
    last();
    setUndos(undos.slice(0, -1));
  }

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(0), 1400);
    return () => clearTimeout(t);
  }, [added]);

  return (
    <View style={[styles.row, !first && { borderTopColor: colors.hairline, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${name}${recipe ? ', recipe' : ''}, ${detail}, ${formatInt(kcal)} calories. ${pressHint}`}
        pressedScale={0.985}
        onPress={onPress}
        style={styles.main}>
        <View style={styles.text}>
          <View style={styles.titleRow}>
            {favorite ? <Icon name="star" size={12} color="carbs" filled /> : null}
            <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
              {name}
            </Text>
          </View>
          <View style={styles.detailRow}>
            {recipe ? (
              <RecipeTag />
            ) : tag ? (
              <View style={[styles.tag, { borderColor: colors.hairlineStrong }]}>
                <Text variant="label" style={styles.tagText}>
                  {tag}
                </Text>
              </View>
            ) : null}
            <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.detail}>
              {detail}
            </Text>
          </View>
        </View>
        <View style={styles.kcal}>
          <Text variant="smallStrong" color="textSecondary" tabular>
            {formatInt(kcal)}
          </Text>
          {macros ? <MacroMix p={macros.p} c={macros.c} f={macros.f} width={24} /> : null}
        </View>
      </PressableScale>
      {count > 0 ? (
        <Animated.View entering={ZoomIn.springify().damping(16)} style={[styles.stepper, { backgroundColor: recipe ? colors.recipeSoft : colors.accentSoft }]}>
          <PressableScale accessibilityRole="button" accessibilityLabel={`Remove one ${name}`} hitSlop={6} pressedScale={0.85} ripple={null} onPress={remove} style={styles.step}>
            <Icon name="minus" size={16} color={tint} strokeWidth={2.4} />
          </PressableScale>
          <Animated.View key={count} entering={ZoomIn.duration(160)}>
            <Text variant="smallStrong" color={tint} tabular style={styles.count} accessibilityLabel={`${count} added`}>
              {count}
            </Text>
          </Animated.View>
          <PressableScale accessibilityRole="button" accessibilityLabel={`Add another ${name}`} hitSlop={6} pressedScale={0.85} ripple={null} onPress={add} style={styles.step}>
            <Icon name="plus" size={16} color={tint} strokeWidth={2.4} />
          </PressableScale>
        </Animated.View>
      ) : (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Add ${name}`}
          hitSlop={8}
          pressedScale={0.88}
          ripple={null}
          onPress={add}
          style={[styles.add, { backgroundColor: added ? colors.good : recipe ? colors.recipeSoft : colors.accentSoft }]}>
          {added ? (
            <Animated.View key={added} entering={ZoomIn.springify().damping(14)}>
              <Icon name="check" size={17} color="bg" strokeWidth={2.6} />
            </Animated.View>
          ) : (
            <Icon name="plus" size={17} color={tint} strokeWidth={2.4} />
          )}
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderRadius: radius.md },
  text: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { flexShrink: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detail: { flexShrink: 1 },
  tag: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  tagText: { fontSize: 8.5, lineHeight: 11, letterSpacing: 0.5 },
  kcal: { alignItems: 'flex-end', gap: 5 },
  add: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stepper: { height: 34, borderRadius: 17, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  step: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 18, textAlign: 'center' },
});
