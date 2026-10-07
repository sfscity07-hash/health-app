import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FoodRow } from '@/components/food/FoodRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { ToastHost } from '@/components/ui/ToastHost';
import { useFoodLogs } from '@/features/dashboard/api';
import { useFavorites, useLogFood, useMyFoods, useRecentLogs } from '@/features/food/api';
import { matches, rankRecents, type RecentFood } from '@/features/food/recents';
import { useDayBudget } from '@/features/food/useDayBudget';
import { MIN_SEARCH_LENGTH, useFoodSearch, useFoundFoods, type SearchOutcome } from '@/features/search/api';
import { MIN_RELEVANCE, relevance, withoutLocal } from '@/features/search/rank';
import { asFood, SOURCE_TAG, type ExternalFood } from '@/features/search/types';
import { fromISODate, toISODate } from '@/lib/dates';
import { formatDayLabel, formatInt } from '@/lib/format';
import { isMeal, MEAL_LABEL, MEALS, mealForTime, type Meal } from '@/lib/meals';
import { defaultPortion, describeLogged, formatQty, nutrientsFor, type FoodRecord } from '@/lib/portion';
import { useViewedDate } from '@/store/day';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { fonts, gutter, radius, space } from '@/theme/tokens';

type Action = { icon: IconName; label: string; onPress: () => void; soon?: boolean };

const macrosOf = (n: { protein_g: number; carbs_g: number; fat_g: number }) => ({ p: n.protein_g, c: n.carbs_g, f: n.fat_g });

/** A line under the database results when a source didn't answer. */
function sourceNote(s: SearchOutcome): string | null {
  if (s.usda === 'limited') {
    return 'USDA’s shared demo key is used up for this hour, so only Open Food Facts is shown. A free personal key fixes this (see the README).';
  }
  if (s.usda !== 'ok' && s.off !== 'ok') return 'Couldn’t reach the food databases. Check your connection and try again.';
  if (s.usda !== 'ok') return 'USDA didn’t answer, so these are from Open Food Facts only.';
  if (s.off !== 'ok') return 'Open Food Facts didn’t answer, so these are from USDA only.';
  return null;
}

/** The food logger sheet: search your foods, repeat recent ones in one tap, quick add or create a food. */
export default function LogSheet() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const viewedDay = useViewedDate();
  const date = params.date || viewedDay;
  const today = toISODate(new Date());
  const [meal, setMeal] = useState<Meal>(isMeal(params.meal) ? params.meal : mealForTime(new Date()));
  const [query, setQuery] = useState('');

  const recentLogs = useRecentLogs();
  const myFoods = useMyFoods();
  const favorites = useFavorites();
  const dayLogs = useFoodLogs(date);
  const logFood = useLogFood();
  const showToast = useToast((s) => s.show);
  const { eaten, targets } = useDayBudget(date);
  const db = useFoodSearch(query);
  const keepFound = useFoundFoods((s) => s.keep);

  const q = query.trim();
  const searching = q.length > 0;
  const favs = new Set(favorites.data ?? []);
  const recents = useMemo(
    () => rankRecents(recentLogs.data ?? [], meal, today, searching ? 60 : 12),
    [recentLogs.data, meal, today, searching],
  );
  const recentMatches = recents.filter((r) => matches(q, r.name, r.brand));
  const shownIds = new Set(recentMatches.map((r) => r.foodId));
  const foodMatches = (myFoods.data ?? [])
    .filter((f) => !shownIds.has(f.id) && matches(q, f.name, f.brand))
    .sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id)));
  const loading = recentLogs.isPending || myFoods.isPending;
  const dbActive = q.length >= MIN_SEARCH_LENGTH;
  // Skip database results already listed above (logged before, or one of your own foods).
  const loggedKeys = new Set(recents.map((r) => r.last.external_key).filter((k): k is string => Boolean(k)));
  // While a new search loads, the last one's results stay up (dimmed), minus any that don't fit what you've typed since.
  const stale = db.typing || db.isPlaceholderData;
  const fromDb = (db.data?.results ?? []).filter((f) => !stale || relevance(q, f) > MIN_RELEVANCE);
  const dbResults = dbActive ? withoutLocal(fromDb, loggedKeys, myFoods.data ?? []) : [];
  const dbSettled = dbActive && !db.searching && db.data !== undefined;
  const dbNote = dbSettled && db.data ? sourceNote(db.data) : null;
  const nothingFound = searching && recentMatches.length === 0 && foodMatches.length === 0 && (!dbActive || (dbSettled && dbResults.length === 0));
  const nothingYet = !loading && !searching && recents.length === 0 && foodMatches.length === 0;

  const mealKcal = (dayLogs.data ?? []).filter((e) => e.meal === meal).reduce((s, e) => s + e.kcal, 0);
  const left = targets.kcal - eaten.kcal;

  const openQuickAdd = (extra: Record<string, string> = {}) =>
    router.push({ pathname: '/quick-add', params: { date, meal, ...extra } });
  const openNewFood = (name?: string) => router.push({ pathname: '/food/new', params: { date, meal, name: name ?? '' } });

  const actions: Action[] = [
    { icon: 'bolt', label: 'Quick add', onPress: () => openQuickAdd() },
    { icon: 'plus', label: 'New food', onPress: () => openNewFood() },
    { icon: 'scan', label: 'Scan', soon: true, onPress: () => showToast('Barcode scanning arrives in Phase 6', 'info') },
    { icon: 'bookmark', label: 'Saved', soon: true, onPress: () => showToast('Saved meals arrive in Phase 7', 'info') },
  ];

  function nextMeal() {
    setMeal((m) => MEALS[(MEALS.indexOf(m) + 1) % MEALS.length]);
  }

  function logRecent(r: RecentFood) {
    const l = r.last;
    logFood.mutate({
      date,
      meal,
      foodId: r.foodId,
      name: r.name,
      brand: r.brand,
      quantity: l.quantity,
      unit: l.unit,
      grams: l.grams,
      nutrients: { kcal: l.kcal, protein_g: l.protein_g, carbs_g: l.carbs_g, fat_g: l.fat_g, fiber_g: l.fiber_g },
    });
    showToast(`Added ${r.name} · ${formatInt(l.kcal)} kcal`);
  }

  function openRecent(r: RecentFood) {
    const l = r.last;
    if (r.foodId) {
      router.push({ pathname: '/food/[id]', params: { id: r.foodId, date, meal, qty: String(l.quantity), unit: l.unit } });
    } else {
      const g = (v: number) => (v > 0 ? formatQty(v) : '');
      openQuickAdd({ name: r.name, kcal: formatQty(l.kcal), protein: g(l.protein_g), carbs: g(l.carbs_g), fat: g(l.fat_g), fiber: g(l.fiber_g) });
    }
  }

  function logFoodRecord(f: FoodRecord) {
    const p = defaultPortion(f);
    const nutrients = nutrientsFor(f, p.grams);
    logFood.mutate({ date, meal, foodId: f.id, name: f.name, brand: f.brand, quantity: p.qty, unit: p.unit, grams: p.grams, nutrients });
    showToast(`Added ${f.name} · ${formatInt(nutrients.kcal)} kcal`);
  }

  const openFood = (f: FoodRecord) => router.push({ pathname: '/food/[id]', params: { id: f.id, date, meal } });

  function openFound(f: ExternalFood) {
    keepFound(f);
    router.push({ pathname: '/food/preview', params: { key: f.key, date, meal } });
  }

  function logFound(f: ExternalFood) {
    const food = asFood(f);
    const p = defaultPortion(food);
    const nutrients = nutrientsFor(food, p.grams);
    logFood.mutate({ date, meal, foodId: null, external: f, name: f.name, brand: f.brand, quantity: p.qty, unit: p.unit, grams: p.grams, nutrients });
    showToast(`Added ${f.name} · ${formatInt(nutrients.kcal)} kcal`);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.surface1 }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="label">{date === today ? 'Today' : formatDayLabel(fromISODate(date))}</Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Adding to ${MEAL_LABEL[meal]}. Tap to change meal.`}
            haptic="tick"
            hapticOn="pressIn"
            pressedScale={0.97}
            ripple={null}
            onPress={nextMeal}
            style={styles.mealButton}>
            <Text variant="title">
              <Text variant="title" color="textTertiary">
                Add to{' '}
              </Text>
              {MEAL_LABEL[meal]}
            </Text>
            <Icon name="chevronDown" size={18} color="textSecondary" strokeWidth={2.2} />
          </PressableScale>
          <Text variant="caption" color="textSecondary" tabular>
            {mealKcal > 0 ? `${MEAL_LABEL[meal]} so far ${formatInt(mealKcal)} kcal` : `Nothing in ${MEAL_LABEL[meal].toLowerCase()} yet`}
            {' · '}
            {left >= 0 ? `${formatInt(left)} kcal left today` : `${formatInt(-left)} kcal over today`}
          </Text>
        </View>
        <IconButton icon="close" label="Close" size={36} onPress={() => router.back()} />
      </View>

      <View style={[styles.search, { backgroundColor: colors.surface2, borderColor: colors.hairline }]}>
        <Icon name="search" size={17} color="textTertiary" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search foods"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search foods"
          style={[styles.searchInput, { color: colors.text }, Platform.OS === 'web' && styles.noWebOutline]}
        />
        {searching ? (
          <IconButton icon="close" label="Clear search" size={30} onPress={() => setQuery('')} />
        ) : (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Scan a barcode"
            onPress={() => showToast('Barcode scanning arrives in Phase 6', 'info')}
            style={[styles.scan, { backgroundColor: colors.surface3 }]}>
            <Icon name="scan" size={17} />
          </PressableScale>
        )}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 96 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled>
        {!searching ? (
          <View style={styles.actions}>
            {actions.map((a) => (
              <PressableScale
                key={a.label}
                accessibilityRole="button"
                accessibilityLabel={a.soon ? `${a.label}, coming soon` : a.label}
                haptic="tap"
                onPress={a.onPress}
                style={[styles.action, { backgroundColor: colors.surface2 }]}>
                <Icon name={a.icon} size={20} color={a.soon ? 'textTertiary' : 'accent'} />
                <Text variant="caption" color={a.soon ? 'textTertiary' : 'text'}>
                  {a.label}
                </Text>
                {a.soon ? (
                  <Text variant="label" style={styles.soon}>
                    Soon
                  </Text>
                ) : null}
              </PressableScale>
            ))}
          </View>
        ) : null}

        {nothingYet ? (
          <Card style={styles.note}>
            <Text variant="bodyStrong">Your foods will live here</Text>
            <Text variant="small" color="textSecondary">
              Log something with Quick add or New food. Next time it’s one tap away, and the foods you eat most rise to the top.
            </Text>
          </Card>
        ) : null}

        {recentMatches.length > 0 ? (
          <View>
            <View style={styles.sectionHead}>
              <Text variant="label">{searching ? 'Recent' : `Recent for ${MEAL_LABEL[meal].toLowerCase()}`}</Text>
              <Text variant="label">kcal</Text>
            </View>
            {recentMatches.map((r, i) => (
              <FoodRow
                key={r.key}
                first={i === 0}
                name={r.name}
                detail={r.foodId ? [describeLogged(r.last.quantity, r.last.unit, r.last.grams), r.brand].filter(Boolean).join(' · ') : 'Quick add'}
                kcal={r.last.kcal}
                macros={macrosOf(r.last)}
                favorite={r.foodId ? favs.has(r.foodId) : false}
                onPress={() => openRecent(r)}
                onAdd={() => logRecent(r)}
              />
            ))}
          </View>
        ) : null}

        {foodMatches.length > 0 ? (
          <View>
            <View style={styles.sectionHead}>
              <Text variant="label">Your foods</Text>
              <Text variant="label">kcal</Text>
            </View>
            {foodMatches.map((f, i) => {
              const p = defaultPortion(f);
              const n = nutrientsFor(f, p.grams);
              return (
                <FoodRow
                  key={f.id}
                  first={i === 0}
                  name={f.name}
                  detail={[describeLogged(p.qty, p.unit, p.unit === 'g' ? null : p.grams), f.brand].filter(Boolean).join(' · ')}
                  kcal={n.kcal}
                  macros={macrosOf(n)}
                  favorite={favs.has(f.id)}
                  onPress={() => openFood(f)}
                  onAdd={() => logFoodRecord(f)}
                />
              );
            })}
          </View>
        ) : null}

        {dbActive && (dbResults.length > 0 || db.searching) ? (
          <View>
            <View style={styles.sectionHead}>
              <Text variant="label">Food database</Text>
              {db.searching ? (
                <ActivityIndicator size="small" color={colors.textTertiary} accessibilityLabel="Searching" style={styles.spinner} />
              ) : (
                <Text variant="label">kcal</Text>
              )}
            </View>
            {dbResults.length === 0 ? (
              <Text variant="small" color="textSecondary" style={styles.searchingText}>
                Searching USDA and Open Food Facts…
              </Text>
            ) : null}
            <View style={stale && db.searching ? styles.stale : undefined}>
              {dbResults.map((f, i) => {
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
                    onPress={() => openFound(f)}
                    onAdd={() => logFound(f)}
                  />
                );
              })}
            </View>
            {dbNote && dbResults.length > 0 ? (
              <Text variant="caption" color="textTertiary" style={styles.dbNote}>
                {dbNote}
              </Text>
            ) : null}
          </View>
        ) : null}

        {nothingFound ? (
          <Card style={styles.note}>
            <Text variant="bodyStrong">{dbActive ? `Nothing found for “${q}”` : `No “${q}” in your foods yet`}</Text>
            <Text variant="small" color="textSecondary">
              {dbNote && dbActive
                ? dbNote
                : dbActive
                  ? 'Try fewer or different words, or add it yourself from the label.'
                  : 'Keep typing to search USDA and Open Food Facts, or add it yourself.'}
            </Text>
            <View style={styles.noteActions}>
              <Button label={`Create “${q.length > 18 ? `${q.slice(0, 18)}…` : q}”`} icon="plus" variant="secondary" onPress={() => openNewFood(q)} />
              <Button label="Quick add instead" variant="ghost" onPress={() => openQuickAdd({ name: q })} />
            </View>
          </Card>
        ) : null}
      </ScrollView>

      <ToastHost bottom={insets.bottom + 24} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: space.xxl, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: gutter, gap: space.md },
  headerText: { flex: 1, gap: 3 },
  mealButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: radius.sm },
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
  scan: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: gutter, gap: space.xl },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.lg },
  soon: { position: 'absolute', top: 6, right: 7, fontSize: 8, letterSpacing: 0.6 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 34 + space.sm, marginBottom: space.xs },
  note: { padding: space.lg, gap: space.sm },
  noteActions: { gap: space.xs, marginTop: space.xs },
  spinner: { transform: [{ scale: 0.7 }], height: 13 },
  searchingText: { paddingVertical: space.md },
  dbNote: { marginTop: space.sm },
  stale: { opacity: 0.45 },
});
