import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import type { FoodLogEntry } from '@/features/dashboard/api';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatInt } from '@/lib/format';
import { MEAL_LABEL, MEALS, type Meal } from '@/lib/meals';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

const ORDER: Meal[] = ['breakfast', 'lunch', 'snack', 'dinner'];

function timeOf(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  return { time: `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`, ap: h < 12 ? 'AM' : 'PM' };
}

/** Pulsing dot that marks the next meal to log. */
function PulseDot() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const ring = useSharedValue(0);
  useEffect(() => {
    if (!reduced) ring.set(withRepeat(withTiming(1, { duration: 1800 }), -1, true));
  }, [reduced, ring]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 * ring.get(), transform: [{ scale: 1 + ring.get() * 0.9 }] }));
  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.halo, { backgroundColor: colors.accent }, halo]} />
      <View style={[styles.dot, { borderColor: colors.accent, backgroundColor: colors.bg }]} />
    </View>
  );
}

function MacroMix({ p, c, f }: { p: number; c: number; f: number }) {
  const { colors } = useTheme();
  const parts = [
    { v: p * 4, color: colors.protein },
    { v: c * 4, color: colors.carbs },
    { v: f * 9, color: colors.fat },
  ].filter((x) => x.v > 0.5);
  return (
    <View style={styles.mix}>
      {parts.map((x, i) => (
        <View key={i} style={{ flex: x.v, backgroundColor: x.color }} />
      ))}
    </View>
  );
}

type FoodTimelineProps = {
  entries: FoodLogEntry[];
  /** The meal to highlight as next, or null for past days. */
  nextMeal: Meal | null;
  kcalLeft: number;
  onAdd: (meal: Meal) => void;
};

/** Today's food on a time rail, one section per meal, with the next meal waiting to be filled. */
export function FoodTimeline({ entries, nextMeal, kcalLeft, onAdd }: FoodTimelineProps) {
  const { colors } = useTheme();
  const byMeal = new Map<Meal, FoodLogEntry[]>(MEALS.map((m) => [m, []]));
  for (const e of entries) byMeal.get(e.meal)?.push(e);
  const visible = ORDER.filter((m) => (byMeal.get(m)?.length ?? 0) > 0 || m === nextMeal);

  if (visible.length === 0) {
    return (
      <Text variant="small" color="textSecondary">
        Nothing was logged on this day.
      </Text>
    );
  }

  return (
    <View>
      {visible.map((meal, idx) => {
        const items = byMeal.get(meal) ?? [];
        const last = idx === visible.length - 1;
        const kcal = items.reduce((s, i) => s + i.kcal, 0);
        const first = items[0] ? timeOf(items[0].logged_at) : null;
        return (
          <View key={meal} style={styles.meal}>
            <View style={styles.timeCol}>
              {first ? (
                <>
                  <Text variant="label" color="textSecondary" style={styles.time}>
                    {first.time}
                  </Text>
                  <Text variant="label">{first.ap}</Text>
                </>
              ) : (
                <Text variant="label" color="accent">
                  Next
                </Text>
              )}
            </View>
            <View style={[styles.rail, { borderLeftColor: last ? 'transparent' : colors.hairlineStrong }]}>
              <View style={styles.marker}>
                {items.length === 0 ? <PulseDot /> : <View style={[styles.dot, { borderColor: colors.textTertiary, backgroundColor: colors.bg }]} />}
              </View>
              {items.length === 0 ? (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${MEAL_LABEL[meal].toLowerCase()}`}
                  haptic="tap"
                  pressedScale={0.98}
                  onPress={() => onAdd(meal)}
                  style={[styles.slot, { borderColor: colors.hairlineStrong }]}>
                  <View style={styles.slotHead}>
                    <Text variant="smallStrong">{MEAL_LABEL[meal]}</Text>
                    <Text variant="caption" color="textSecondary" tabular>
                      {kcalLeft > 0 ? `${formatInt(kcalLeft)} kcal left` : 'Over budget'}
                    </Text>
                  </View>
                  <View style={[styles.addRow, { backgroundColor: colors.surface2 }]}>
                    <Icon name="plus" size={14} color="accent" strokeWidth={2.4} />
                    <Text variant="smallStrong">Add {MEAL_LABEL[meal].toLowerCase()}</Text>
                  </View>
                </PressableScale>
              ) : (
                <View>
                  <View style={styles.mealHead}>
                    <Text variant="smallStrong">{MEAL_LABEL[meal]}</Text>
                    <Text variant="caption" color="textSecondary" tabular>
                      {formatInt(kcal)}
                    </Text>
                  </View>
                  {items.map((it, n) => (
                    <View key={it.id} style={[styles.item, n > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.hairline }]}>
                      <View style={styles.itemText}>
                        <Text variant="small" numberOfLines={1}>
                          {it.name}
                        </Text>
                        <Text variant="caption" color="textTertiary">
                          {`${+it.quantity.toFixed(2)} ${it.unit}`}
                        </Text>
                      </View>
                      <View style={styles.itemKcal}>
                        <Text variant="smallStrong" tabular>
                          {formatInt(it.kcal)}
                        </Text>
                        <MacroMix p={it.protein_g} c={it.carbs_g} f={it.fat_g} />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  meal: { flexDirection: 'row' },
  timeCol: { width: 42, paddingTop: 1 },
  time: { fontSize: 11 },
  rail: { flex: 1, borderLeftWidth: 1, paddingLeft: space.lg, paddingBottom: space.lg + 2 },
  marker: { position: 'absolute', left: -5.5, top: 2 },
  dotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  mealHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  itemText: { flex: 1, minWidth: 0 },
  itemKcal: { alignItems: 'flex-end', gap: 5 },
  mix: { flexDirection: 'row', width: 28, height: 3, borderRadius: 2, overflow: 'hidden', gap: 1 },
  slot: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg, padding: space.md, gap: space.sm + 2, marginTop: -3 },
  slotHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 9, paddingHorizontal: 11, borderRadius: radius.md },
});
