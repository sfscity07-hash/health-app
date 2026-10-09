import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditorStatus } from '@/components/food/EditorStatus';
import { FoodDetail, type PortionChoice } from '@/components/food/FoodDetail';
import { FoodRow } from '@/components/food/FoodRow';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useFood, useMyFoods, useRecentLogs, type FoodWithServings } from '@/features/food/api';
import { matches } from '@/features/food/recents';
import { useFoodsByIds, useRecipeIds } from '@/features/recipes/api';
import { useRecipeDraft } from '@/features/recipes/draft';
import { itemFromFood, swapItem, type RecipeItem } from '@/features/recipes/logic';
import { MIN_SEARCH_LENGTH, useFoodSearch } from '@/features/search/api';
import { asFood, SOURCE_TAG, type ExternalFood } from '@/features/search/types';
import { formatInt } from '@/lib/format';
import { success } from '@/lib/haptics';
import { defaultPortion, describeLogged, nutrientsFor, type FoodRecord } from '@/lib/portion';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { fonts, gutter, space } from '@/theme/tokens';

type Mode = 'add' | 'swap' | 'amount';
type Chosen = { kind: 'saved'; id: string } | { kind: 'external'; food: ExternalFood };
const ZERO = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
const macrosOf = (n: { protein_g: number; carbs_g: number; fat_g: number }) => ({ p: n.protein_g, c: n.carbs_g, f: n.fat_g });

/** The amount screen for one ingredient: how much went in (or, when swapping, how much of the new food). */
function AmountStep({
  food,
  external,
  mode,
  old,
  onDone,
}: {
  food: FoodWithServings;
  external: ExternalFood | null;
  mode: Mode;
  old: RecipeItem | null;
  onDone: (item: RecipeItem) => void;
}) {
  // Swapping keeps the weight: 200 g of paneer becomes 200 g of the new food.
  const start = mode === 'amount' && old ? { unit: old.unit, qty: old.quantity } : mode === 'swap' && old?.grams ? { unit: 'g', qty: Math.round(old.grams) } : null;
  return (
    <FoodDetail
      food={food}
      mode="add"
      purpose="ingredient"
      initialUnit={start?.unit}
      initialQty={start?.qty}
      initialMeal="lunch"
      before={ZERO}
      targets={ZERO}
      saving={false}
      submitLabel={mode === 'amount' ? 'Update amount' : mode === 'swap' && old ? `Use instead of ${old.name.length > 18 ? `${old.name.slice(0, 18)}…` : old.name}` : 'Add to recipe'}
      onClose={() => router.back()}
      onSubmit={(c: PortionChoice) => onDone(itemFromFood(food, c.qty, c.unit.label, c.grams, external))}
    />
  );
}

function SavedAmount({ id, ...rest }: { id: string; mode: Mode; old: RecipeItem | null; onDone: (item: RecipeItem) => void }) {
  const food = useFood(id);
  if (food.isPending) return <EditorStatus title="Ingredient" onClose={() => router.back()} />;
  if (!food.data) return <EditorStatus title="Ingredient" onClose={() => router.back()} problem={{ title: 'Couldn’t open this food', body: 'Go back and try again.' }} />;
  return <AmountStep food={food.data} external={null} {...rest} />;
}

/** Pick an ingredient for a recipe (your foods, recipes, recent foods or the food database), or a replacement for one. */
export default function IngredientPicker() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: Mode; key?: string; exclude?: string }>();
  const mode: Mode = params.mode === 'swap' || params.mode === 'amount' ? params.mode : 'add';
  const items = useRecipeDraft((s) => s.draft.items);
  const addItem = useRecipeDraft((s) => s.addItem);
  const replaceItem = useRecipeDraft((s) => s.replaceItem);
  const showToast = useToast((s) => s.show);
  const old = params.key ? (items.find((i) => i.key === params.key) ?? null) : null;
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Chosen | null>(null);

  const myFoods = useMyFoods();
  const recipeIds = useRecipeIds();
  const recentLogs = useRecentLogs();
  const db = useFoodSearch(query);
  const q = query.trim();
  const searching = q.length > 0;

  const recentIds = useMemo(() => {
    const seen = new Set<string>();
    for (const r of recentLogs.data ?? []) if (r.food_id && !seen.has(r.food_id)) seen.add(r.food_id);
    return [...seen].slice(0, 30);
  }, [recentLogs.data]);
  const recentFoods = useFoodsByIds(recentIds);

  // A recipe can't be its own ingredient.
  const allowed = (f: FoodRecord) => f.id !== params.exclude;
  const mine = (myFoods.data ?? []).filter((f) => allowed(f) && matches(q, f.name, f.brand));
  const mineIds = new Set(mine.map((f) => f.id));
  const recent = (recentFoods.data ?? []).filter((f) => allowed(f) && !mineIds.has(f.id) && f.source !== 'custom' && matches(q, f.name, f.brand)).slice(0, searching ? 10 : 8);
  const dbFoods = db.enabled ? (db.data?.results ?? []).slice(0, 20) : [];

  function done(item: RecipeItem) {
    success();
    if (mode === 'add') {
      addItem(item);
      showToast(`Added ${item.name} · ${formatInt(item.nutrients.kcal)} kcal`);
    } else if (old) {
      replaceItem(old.key, item);
      showToast(mode === 'swap' ? `Swapped ${old.name} for ${item.name}` : `Updated ${item.name}`);
    }
    router.back();
  }

  /** One tap on +: the food's usual amount when adding, or the same weight when swapping. */
  function quick(food: FoodWithServings, external: ExternalFood | null) {
    if (mode === 'swap' && old) return done(swapItem(old, food, external));
    const p = defaultPortion(food);
    done(itemFromFood(food, p.qty, p.unit, p.grams, external));
  }

  // Changing the amount of an ingredient already in the recipe.
  if (mode === 'amount' && old) {
    if (old.external) return <AmountStep food={asFood(old.external)} external={old.external} mode={mode} old={old} onDone={done} />;
    if (old.food && !old.food.id.includes(':')) return <SavedAmount id={old.food.id} mode={mode} old={old} onDone={done} />;
    if (old.food) return <AmountStep food={old.food} external={null} mode={mode} old={old} onDone={done} />;
  }
  if (chosen?.kind === 'saved') return <SavedAmount id={chosen.id} mode={mode} old={old} onDone={done} />;
  if (chosen?.kind === 'external') return <AmountStep food={asFood(chosen.food)} external={chosen.food} mode={mode} old={old} onDone={done} />;

  const row = (f: FoodRecord, i: number, tag?: string) => {
    const p = defaultPortion(f);
    const n = nutrientsFor(f, p.grams);
    return (
      <FoodRow
        key={f.id}
        first={i === 0}
        name={f.name}
        tag={tag}
        detail={[describeLogged(p.qty, p.unit, p.unit === 'g' ? null : p.grams), f.brand].filter(Boolean).join(' · ')}
        kcal={n.kcal}
        macros={macrosOf(n)}
        pressHint="Pick how much."
        onPress={() => setChosen({ kind: 'saved', id: f.id })}
        onAdd={() => quick({ ...f, servings: [] }, null)}
      />
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.md }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="label">{mode === 'swap' ? 'Swap ingredient' : 'Add ingredient'}</Text>
          <Text variant="title" accessibilityRole="header" numberOfLines={2}>
            {mode === 'swap' && old ? `Instead of ${old.name}` : 'What went in?'}
          </Text>
          {mode === 'swap' && old?.grams ? (
            <Text variant="caption" color="textSecondary">
              + swaps in the same {Math.round(old.grams)} g; tap a food to pick a different amount.
            </Text>
          ) : null}
        </View>
        <IconButton icon="close" label="Close" size={36} onPress={() => router.back()} />
      </View>

      <View style={[styles.search, { backgroundColor: colors.surface2, borderColor: colors.hairline }]}>
        <Icon name="search" size={17} color="textTertiary" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search foods and recipes"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          autoCorrect={false}
          autoFocus={Platform.OS !== 'web'}
          accessibilityLabel="Search foods and recipes"
          style={[styles.searchInput, { color: colors.text }, Platform.OS === 'web' && styles.noWebOutline]}
        />
        {searching ? <IconButton icon="close" label="Clear search" size={30} onPress={() => setQuery('')} /> : null}
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 48 }]} keyboardShouldPersistTaps="handled">
        {mine.length > 0 ? (
          <View>
            <View style={styles.sectionHead}>
              <Text variant="label">Your foods and recipes</Text>
              <Text variant="label">kcal</Text>
            </View>
            {mine.slice(0, searching ? 20 : 12).map((f, i) => row(f, i, recipeIds.has(f.id) ? 'RECIPE' : undefined))}
          </View>
        ) : null}

        {recent.length > 0 ? (
          <View>
            <View style={styles.sectionHead}>
              <Text variant="label">Recent</Text>
              <Text variant="label">kcal</Text>
            </View>
            {recent.map((f, i) => row(f, i, f.source === 'custom' ? undefined : SOURCE_TAG[f.source]))}
          </View>
        ) : null}

        {db.enabled ? (
          <View>
            <View style={styles.sectionHead}>
              <Text variant="label">Food database</Text>
              {db.searching ? <ActivityIndicator size="small" color={colors.textTertiary} accessibilityLabel="Searching" /> : <Text variant="label">kcal</Text>}
            </View>
            {dbFoods.map((f, i) => {
              const food = asFood(f);
              const p = defaultPortion(food);
              const n = nutrientsFor(food, p.grams);
              return (
                <FoodRow
                  key={f.key}
                  first={i === 0}
                  name={f.name}
                  tag={SOURCE_TAG[f.source]}
                  detail={[describeLogged(p.qty, p.unit, p.unit === 'g' ? null : p.grams), f.brand].filter(Boolean).join(' · ')}
                  kcal={n.kcal}
                  macros={macrosOf(n)}
                  pressHint="Pick how much."
                  onPress={() => setChosen({ kind: 'external', food: f })}
                  onAdd={() => quick(food, f)}
                />
              );
            })}
            {!db.searching && dbFoods.length === 0 ? (
              <Text variant="small" color="textSecondary">
                Nothing in the databases for “{q}”. Add it as a quick ingredient with its numbers instead.
              </Text>
            ) : null}
          </View>
        ) : searching && q.length < MIN_SEARCH_LENGTH ? null : !searching ? (
          <Text variant="small" color="textSecondary">
            Type to search USDA and Open Food Facts too: ghee, paneer, Greek yoghurt, soya chaap…
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: space.lg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: gutter },
  headerText: { flex: 1, gap: 3 },
  search: {
    height: 46,
    marginHorizontal: gutter,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
  },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15 },
  noWebOutline: { outlineWidth: 0 },
  list: { paddingHorizontal: gutter, gap: space.xl },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 34 + space.sm, marginBottom: space.xs },
});
