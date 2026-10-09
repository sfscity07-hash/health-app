import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FoodRow } from '@/components/food/FoodRow';
import { ModalHeader } from '@/components/food/ModalHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { ToastHost } from '@/components/ui/ToastHost';
import { loadErrorMessage } from '@/features/auth/errors';
import { useLogFood } from '@/features/food/api';
import { useRecipes } from '@/features/recipes/api';
import { formatInt } from '@/lib/format';
import { isMeal, MEAL_LABEL, mealForTime } from '@/lib/meals';
import { defaultPortion, describeLogged, nutrientsFor } from '@/lib/portion';
import { useViewedDate } from '@/store/day';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';

/** Your recipes: tap + to log the usual amount, tap one to pick an amount or edit it, or start a new one. */
export default function RecipesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const viewed = useViewedDate();
  const date = params.date || viewed;
  const meal = isMeal(params.meal) ? params.meal : mealForTime(new Date());
  const recipes = useRecipes();
  const logFood = useLogFood();
  const showToast = useToast((s) => s.show);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ModalHeader title="Recipes" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}>
        <View style={styles.intro}>
          <Text variant="title" accessibilityRole="header">
            Your recipes
          </Text>
          <Text variant="small" color="textSecondary">
            Anything you make from several foods: a marinade, a curry, a smoothie. Log it by the gram, the serving or a share of the batch. Tap + to add the usual amount to {MEAL_LABEL[meal].toLowerCase()}.
          </Text>
        </View>
        <Button label="New recipe" icon="plus" onPress={() => router.push({ pathname: '/recipe/edit', params: { date, meal } })} />

        {recipes.isPending ? <ActivityIndicator color={colors.accent} /> : null}
        {recipes.isError ? (
          <EmptyState icon="fork" title="Couldn’t load your recipes" body={loadErrorMessage(recipes.error, 'Check your internet connection, then close this and open it again.')} />
        ) : null}
        {recipes.data && recipes.data.length === 0 ? (
          <EmptyState
            icon="fork"
            title="No recipes yet"
            body="Tap New recipe, add what went in (ghee, paneer, yoghurt…), and weigh the finished dish if you can. Then log 50 g of it like any food, or use it inside another recipe."
          />
        ) : null}

        <View>
          {(recipes.data ?? []).map((r, i) => {
            const p = defaultPortion(r.food);
            const n = nutrientsFor(r.food, p.grams);
            // What + adds: "4 servings of 130 g", or "520 g batch · 100 g".
            const size = r.servings
              ? [`${r.servings} serving${r.servings === 1 ? '' : 's'} of ${formatInt(p.grams)} g`]
              : [r.finalWeight ? `${formatInt(r.finalWeight)} g batch` : null, describeLogged(p.qty, p.unit, p.unit === 'g' ? null : p.grams)];
            return (
              <FoodRow
                key={r.id}
                first={i === 0}
                name={r.food.name}
                detail={[`${r.itemCount} ingredient${r.itemCount === 1 ? '' : 's'}`, ...size].filter(Boolean).join(' · ')}
                kcal={n.kcal}
                macros={{ p: n.protein_g, c: n.carbs_g, f: n.fat_g }}
                pressHint="Opens the recipe."
                onPress={() => router.push({ pathname: '/food/[id]', params: { id: r.id, date, meal } })}
                onAdd={() => {
                  logFood.mutate({ date, meal, foodId: r.id, name: r.food.name, brand: null, quantity: p.qty, unit: p.unit, grams: p.grams, nutrients: n });
                  showToast(`Added ${r.food.name} · ${formatInt(n.kcal)} kcal`);
                }}
              />
            );
          })}
        </View>
      </ScrollView>
      <ToastHost bottom={insets.bottom + 24} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gutter, gap: space.lg },
  intro: { gap: space.xs, marginTop: space.sm },
});
