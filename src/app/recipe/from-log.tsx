import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { EditorFooter } from '@/components/food/EditorFooter';
import { ModalHeader } from '@/components/food/ModalHeader';
import { RecipeGlyph } from '@/components/food/RecipeMarks';
import { relativeDay } from '@/components/foodlog/DayNav';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { loadErrorMessage } from '@/features/auth/errors';
import { useFoodLogs, type FoodLogEntry } from '@/features/dashboard/api';
import { useFoodsByIds, useRecipeIds } from '@/features/recipes/api';
import { useRecipeDraft } from '@/features/recipes/draft';
import { emptyDraft, itemsFromLog } from '@/features/recipes/logic';
import { toISODate } from '@/lib/dates';
import { formatInt } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { isMeal, MEAL_LABEL, MEALS } from '@/lib/meals';
import { describeLogged } from '@/lib/portion';
import { useTheme } from '@/theme/theme';
import { gutter, radius, space } from '@/theme/tokens';

/** "today", "yesterday", "on Monday", "on 5 Oct". */
function when(date: string, today: string) {
  const day = relativeDay(date, today);
  return day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : `on ${day}`;
}

/** Pick foods you logged on a day (from any meal) and turn them into a recipe, at the amounts you logged. */
export default function RecipeFromLogScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const today = toISODate(new Date());
  const date = params.date || today;
  const meal = isMeal(params.meal) ? params.meal : null;
  const logs = useFoodLogs(date);
  const recipeIds = useRecipeIds();
  const entries = useMemo(() => (logs.data ?? []).filter((e) => !e.id.startsWith('temp-')), [logs.data]);
  const foodIds = useMemo(() => [...new Set(entries.flatMap((e) => (e.food_id ? [e.food_id] : [])))], [entries]);
  const foods = useFoodsByIds(foodIds);
  // Until you change it, the meal you came from is ticked.
  const [picked, setPicked] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosenIds = picked ?? entries.filter((e) => e.meal === meal).map((e) => e.id);
  const chosen = entries.filter((e) => chosenIds.includes(e.id));
  const kcal = chosen.reduce((s, e) => s + e.kcal, 0);

  const set = (ids: string[]) => {
    setPicked(ids);
    setError(null);
  };
  const toggle = (id: string) => set(chosenIds.includes(id) ? chosenIds.filter((x) => x !== id) : [...chosenIds, id]);

  function build() {
    if (chosen.length === 0) return setError('Pick at least one food.');
    const byId = new Map((foods.data ?? []).map((f) => [f.id, f]));
    // In meal order, then the order you logged them.
    const ordered = MEALS.flatMap((m) => chosen.filter((e) => e.meal === m));
    useRecipeDraft.getState().start({ ...emptyDraft(), items: itemsFromLog(ordered, byId) }, 'new');
    tap();
    router.replace('/recipe/edit');
  }

  const groups = MEALS.map((m) => ({ meal: m, entries: entries.filter((e) => e.meal === m) })).filter((g) => g.entries.length > 0);

  const row = (e: FoodLogEntry, i: number) => {
    const on = chosenIds.includes(e.id);
    return (
      <PressableScale
        key={e.id}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={`${e.name}, ${e.food_id ? describeLogged(e.quantity, e.unit, null) : 'quick add'}, ${formatInt(e.kcal)} calories`}
        haptic="tick"
        pressedScale={1}
        onPress={() => toggle(e.id)}
        style={[styles.row, i > 0 && { borderTopColor: colors.hairline, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
        <View style={[styles.check, on ? { backgroundColor: colors.recipe, borderColor: colors.recipe } : { borderColor: colors.hairlineStrong }]}>
          {on ? <Icon name="check" size={13} color="bg" strokeWidth={3} /> : null}
        </View>
        <View style={styles.rowText}>
          <View style={styles.nameRow}>
            {e.food_id && recipeIds.has(e.food_id) ? <RecipeGlyph /> : null}
            <Text variant="body" numberOfLines={1} color={on ? 'text' : 'textSecondary'} style={styles.name}>
              {e.name}
            </Text>
          </View>
          <Text variant="caption" color="textTertiary" numberOfLines={1}>
            {e.food_id ? describeLogged(e.quantity, e.unit, e.unit === 'g' ? null : e.grams) : 'Quick add'}
            {e.brand ? ` · ${e.brand}` : ''}
          </Text>
        </View>
        <Text variant="smallStrong" color={on ? 'textSecondary' : 'textTertiary'} tabular>
          {formatInt(e.kcal)}
        </Text>
      </PressableScale>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ModalHeader title="New recipe" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text variant="title" accessibilityRole="header">
            What went into it?
          </Text>
          <Text variant="small" color="textSecondary">
            Tick the foods you logged {when(date, today)} that make up the dish. They come in at the amounts you logged; you can change them, name it and set servings next. Your log stays as it is.
          </Text>
        </View>

        {logs.isError ? <EmptyState icon="pot" title="Couldn’t load that day" body={loadErrorMessage(logs.error)} /> : null}
        {logs.isSuccess && entries.length === 0 ? (
          <EmptyState icon="pot" title="Nothing logged that day" body="Log the foods that went into your dish, then come back here to make them a recipe." />
        ) : null}

        {groups.map((g) => {
          const ids = g.entries.map((e) => e.id);
          const all = ids.every((id) => chosenIds.includes(id));
          return (
            <View key={g.meal} style={styles.group}>
              <View style={styles.groupHead}>
                <Text variant="label">{MEAL_LABEL[g.meal]}</Text>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`${all ? 'Untick' : 'Tick'} all of ${MEAL_LABEL[g.meal].toLowerCase()}`}
                  haptic="tick"
                  pressedScale={0.95}
                  hitSlop={8}
                  onPress={() => set(all ? chosenIds.filter((id) => !ids.includes(id)) : [...new Set([...chosenIds, ...ids])])}>
                  <Text variant="smallStrong" color="recipe">
                    {all ? 'Untick all' : 'Tick all'}
                  </Text>
                </PressableScale>
              </View>
              <Card style={styles.card}>{g.entries.map(row)}</Card>
            </View>
          );
        })}
      </ScrollView>
      <EditorFooter
        label="Build recipe"
        trailing={chosen.length ? `${chosen.length} food${chosen.length === 1 ? '' : 's'} · ${formatInt(kcal)} kcal` : undefined}
        onPress={build}
        loading={foods.isFetching && !foods.data}
        error={error}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxl, gap: space.xl },
  intro: { gap: space.xs, marginTop: space.sm },
  group: { gap: space.xs },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  check: { width: 22, height: 22, borderRadius: radius.sm - 3, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1 },
});
