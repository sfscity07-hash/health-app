import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditorStatus } from '@/components/food/EditorStatus';
import { FoodDetail, type PortionChoice } from '@/components/food/FoodDetail';
import { FoodRow } from '@/components/food/FoodRow';
import { RecipePortion } from '@/components/food/RecipePortion';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useFood, useMyFoods, useRecentLogs, type FoodWithServings } from '@/features/food/api';
import { matches } from '@/features/food/recents';
import { useFoodsByIds, useRecipe, useRecipeIds, useRecipes } from '@/features/recipes/api';
import { useRecipeDraft, useScannedIngredient } from '@/features/recipes/draft';
import { describeItem, itemFromFood, quickItem, swapItem, type RecipeItem } from '@/features/recipes/logic';
import { ideaLabel, ingredientIdeas, mentions, nameOverlap, swapIdeas } from '@/features/recipes/suggest';
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
/** The idea chip that lists a similar recipe's ingredients rather than searching. */
const FROM_RECIPE = '\u0000recipe';
const ZERO = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
const macrosOf = (n: { protein_g: number; carbs_g: number; fat_g: number }) => ({ p: n.protein_g, c: n.carbs_g, f: n.fat_g });

/** The amount screen for one ingredient: how much went in (or, when swapping, how much of the new food). */
function AmountStep({
  food,
  external,
  mode,
  old,
  onDone,
  recipe,
}: {
  food: FoodWithServings;
  external: ExternalFood | null;
  mode: Mode;
  old: RecipeItem | null;
  onDone: (item: RecipeItem) => void;
  /** The food is itself a recipe: show what's in the amount. */
  recipe?: boolean;
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
      recipe={recipe}
      extra={recipe ? (portion) => <RecipePortion id={food.id} {...portion} /> : undefined}
    />
  );
}

function SavedAmount({ id, ...rest }: { id: string; mode: Mode; old: RecipeItem | null; onDone: (item: RecipeItem) => void }) {
  const food = useFood(id);
  const recipeIds = useRecipeIds();
  if (food.isPending) return <EditorStatus title="Ingredient" onClose={() => router.back()} />;
  if (!food.data) return <EditorStatus title="Ingredient" onClose={() => router.back()} problem={{ title: 'Couldn’t open this food', body: 'Go back and try again.' }} />;
  return <AmountStep food={food.data} external={null} recipe={recipeIds.has(id)} {...rest} />;
}

/** A copy of an ingredient from another recipe, at the same amount. */
const copyOf = (i: RecipeItem): RecipeItem => (i.food ? itemFromFood(i.food, i.quantity, i.unit, i.grams ?? 0) : quickItem(i.name, i.nutrients, i.grams));

/**
 * Pick an ingredient for a recipe (your foods, recipes, recent foods, the food
 * database or a barcode), or a replacement for one. Before you type, ideas from
 * the recipe's name are searched straight away, so the usual ingredients are
 * one tap.
 */
export default function IngredientPicker() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: Mode; key?: string; exclude?: string }>();
  const mode: Mode = params.mode === 'swap' || params.mode === 'amount' ? params.mode : 'add';
  const draft = useRecipeDraft((s) => s.draft);
  const items = draft.items;
  const addItem = useRecipeDraft((s) => s.addItem);
  const replaceItem = useRecipeDraft((s) => s.replaceItem);
  const scanned = useScannedIngredient((s) => s.scanned);
  const showToast = useToast((s) => s.show);
  const old = params.key ? (items.find((i) => i.key === params.key) ?? null) : null;
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Chosen | null>(null);
  // undefined: the first idea is on by itself; null: you turned ideas off.
  const [idea, setIdea] = useState<string | null | undefined>(undefined);

  // A scan that's still waiting when the picker closes is dropped.
  useEffect(() => () => useScannedIngredient.getState().clear(), []);

  const myFoods = useMyFoods();
  const recipes = useRecipes();
  const recipeIds = useRecipeIds();
  const recentLogs = useRecentLogs();

  // A saved recipe with a similar name ("Paneer marinade" for "Paneer tikka marinade"): its ingredients are ideas too.
  const similar = useMemo(() => {
    if (mode !== 'add' || !draft.name.trim()) return null;
    let best: { id: string; name: string; score: number } | null = null;
    for (const r of recipes.data ?? []) {
      if (r.id === params.exclude) continue;
      const score = nameOverlap(draft.name, r.food.name);
      if (score > 0 && (!best || score > best.score)) best = { id: r.id, name: r.food.name, score };
    }
    return best;
  }, [mode, draft.name, recipes.data, params.exclude]);
  const similarFood = (recipes.data ?? []).find((r) => r.id === similar?.id)?.food ?? null;
  const similarRecipe = useRecipe(similar?.id);
  const fromSimilar = (similarRecipe.data?.items ?? []).filter(
    (i) => !items.some((x) => (x.food && i.food && x.food.id === i.food.id) || mentions(i.name, x.name) || mentions(x.name, i.name)),
  );

  const ideas = mode === 'swap' && old ? swapIdeas(old.name) : mode === 'add' ? ingredientIdeas(draft.name, items.map((i) => i.name)) : [];
  const chips = [...(similarFood ? [FROM_RECIPE] : []), ...ideas];
  const active = idea === undefined ? (chips[0] ?? null) : idea && chips.includes(idea) ? idea : null;
  const typed = query.trim();
  // What's searched: what you typed, or the idea that's on.
  const term = typed || (active && active !== FROM_RECIPE ? active : '');
  const searching = term.length > 0;
  const fits = (name: string, brand: string | null) => (typed ? matches(typed, name, brand) : !term || mentions(term, `${name} ${brand ?? ''}`));
  const db = useFoodSearch(term);

  const recentIds = useMemo(() => {
    const seen = new Set<string>();
    for (const r of recentLogs.data ?? []) if (r.food_id && !seen.has(r.food_id)) seen.add(r.food_id);
    return [...seen].slice(0, 30);
  }, [recentLogs.data]);
  const recentFoods = useFoodsByIds(recentIds);

  // A recipe can't be its own ingredient.
  const allowed = (f: FoodRecord) => f.id !== params.exclude;
  const mine = (myFoods.data ?? []).filter((f) => allowed(f) && fits(f.name, f.brand));
  const mineIds = new Set(mine.map((f) => f.id));
  const recent = (recentFoods.data ?? []).filter((f) => allowed(f) && !mineIds.has(f.id) && f.source !== 'custom' && fits(f.name, f.brand)).slice(0, searching ? 10 : 8);
  const dbFoods = db.enabled ? (db.data?.results ?? []).slice(0, 20) : [];
  const showingRecipe = !typed && active === FROM_RECIPE;

  function done(item: RecipeItem) {
    success();
    useScannedIngredient.getState().clear();
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
  // A scanned food goes straight to its amount, like one you tapped.
  const pick = scanned ?? chosen;
  if (pick?.kind === 'saved') return <SavedAmount id={pick.id} mode={mode} old={old} onDone={done} />;
  if (pick?.kind === 'external') return <AmountStep food={asFood(pick.food)} external={pick.food} mode={mode} old={old} onDone={done} />;

  const row = (f: FoodRecord, i: number, tag?: string, recipe?: boolean) => {
    const p = defaultPortion(f);
    const n = nutrientsFor(f, p.grams);
    return (
      <FoodRow
        key={f.id}
        first={i === 0}
        name={f.name}
        tag={tag}
        recipe={recipe}
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
          placeholder={active && active !== FROM_RECIPE ? `Search, or see ${ideaLabel(active)} below` : 'Search foods and recipes'}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          autoCorrect={false}
          autoFocus={Platform.OS !== 'web' && chips.length === 0}
          accessibilityLabel="Search foods and recipes"
          style={[styles.searchInput, { color: colors.text }, Platform.OS === 'web' && styles.noWebOutline]}
        />
        {typed ? (
          <IconButton icon="close" label="Clear search" size={30} onPress={() => setQuery('')} />
        ) : (
          <IconButton icon="scan" label="Scan a barcode" size={34} onPress={() => router.push({ pathname: '/scan', params: { for: 'recipe' } })} />
        )}
      </View>

      {chips.length > 0 && !typed ? (
        <View style={styles.ideas}>
          <Text variant="caption" color="textSecondary" style={styles.ideasHead} numberOfLines={1}>
            {mode === 'swap' && old ? `Instead of ${old.name.toLowerCase()}, try` : `Ideas for “${draft.name.trim()}”`}
          </Text>
          <ChipGroup scroll label="Ingredient ideas" inset={gutter}>
            {chips.map((c) => (
              <Chip
                key={c}
                label={c === FROM_RECIPE ? `From your ${similar?.name ?? 'recipe'}` : ideaLabel(c)}
                icon={c === FROM_RECIPE ? 'pot' : undefined}
                accessibilityLabel={c === FROM_RECIPE ? `Ingredients from your ${similar?.name ?? 'recipe'}` : `Show ${ideaLabel(c)}`}
                selected={c === active}
                onPress={() => setIdea(c === active ? null : c)}
              />
            ))}
          </ChipGroup>
        </View>
      ) : null}

      <ScrollView style={styles.flex} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 48 }]} keyboardShouldPersistTaps="handled">
        {showingRecipe && similarFood ? (
          <View>
            <View style={styles.sectionHead}>
              <Text variant="label">Your recipe</Text>
              <Text variant="label">kcal</Text>
            </View>
            {row(similarFood, 0, undefined, true)}
          </View>
        ) : null}

        {showingRecipe && fromSimilar.length > 0 ? (
          <View>
            <View style={styles.sectionHead}>
              <Text variant="label">Or what went into it</Text>
              <Text variant="label">kcal</Text>
            </View>
            {fromSimilar.map((i, n) => (
              <FoodRow
                key={i.key}
                first={n === 0}
                name={i.name}
                recipe={Boolean(i.food && recipeIds.has(i.food.id))}
                detail={describeItem(i)}
                kcal={i.nutrients.kcal}
                macros={macrosOf(i.nutrients)}
                pressHint={i.food ? 'Pick how much.' : 'Adds it as it was.'}
                onPress={() => (i.food && !i.food.id.includes(':') ? setChosen({ kind: 'saved', id: i.food.id }) : done(copyOf(i)))}
                onAdd={() => done(copyOf(i))}
              />
            ))}
            <Text variant="caption" color="textTertiary" style={styles.note}>
              + adds the same amount as in {similar?.name}.
            </Text>
          </View>
        ) : null}

        {!showingRecipe && mine.length > 0 ? (
          <View>
            <View style={styles.sectionHead}>
              <Text variant="label">Your foods and recipes</Text>
              <Text variant="label">kcal</Text>
            </View>
            {mine.slice(0, searching ? 20 : 12).map((f, i) => row(f, i, undefined, recipeIds.has(f.id)))}
          </View>
        ) : null}

        {!showingRecipe && recent.length > 0 ? (
          <View>
            <View style={styles.sectionHead}>
              <Text variant="label">Recent</Text>
              <Text variant="label">kcal</Text>
            </View>
            {recent.map((f, i) => row(f, i, f.source === 'custom' ? undefined : SOURCE_TAG[f.source]))}
          </View>
        ) : null}

        {!showingRecipe && db.enabled ? (
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
                Nothing in the databases for “{ideaLabel(term)}”. Scan its barcode, or add it as a quick ingredient with its numbers.
              </Text>
            ) : null}
          </View>
        ) : !showingRecipe && searching && term.length < MIN_SEARCH_LENGTH ? null : !showingRecipe && !searching ? (
          <Text variant="small" color="textSecondary">
            {mode === 'add' && !draft.name.trim()
              ? 'Name the recipe and Fuel suggests what usually goes in. Or type to search USDA and Open Food Facts, or scan a barcode.'
              : 'Type to search USDA and Open Food Facts too, or scan a barcode: ghee, paneer, Greek yoghurt, soya chaap…'}
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
  ideas: { gap: space.sm, marginTop: -space.xs },
  ideasHead: { paddingHorizontal: gutter },
  list: { paddingHorizontal: gutter, gap: space.xl },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 34 + space.sm, marginBottom: space.xs },
  note: { marginTop: space.sm },
});
