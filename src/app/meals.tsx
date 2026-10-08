import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FoodRow } from '@/components/food/FoodRow';
import { ModalHeader } from '@/components/food/ModalHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { ToastHost } from '@/components/ui/ToastHost';
import { loadErrorMessage } from '@/features/auth/errors';
import { useLogEntries } from '@/features/food/api';
import { useSavedMeals } from '@/features/meals/api';
import { entriesFromMeal, mealSummary, type SavedMeal } from '@/features/meals/logic';
import { formatInt } from '@/lib/format';
import { isMeal, MEAL_LABEL, mealForTime } from '@/lib/meals';
import { useViewedDate } from '@/store/day';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';

/** Your saved meals. Tap + to add one to the meal you're logging; tap a meal to see or change it. */
export default function SavedMealsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const viewed = useViewedDate();
  const date = params.date || viewed;
  const slot = isMeal(params.meal) ? params.meal : mealForTime(new Date());
  const meals = useSavedMeals();
  const logEntries = useLogEntries();
  const showToast = useToast((s) => s.show);

  function add(m: SavedMeal) {
    logEntries.mutate(entriesFromMeal(m, date, slot));
    showToast(`Added ${m.name} · ${formatInt(m.totals.kcal)} kcal`);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ModalHeader title="Saved meals" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}>
        <View style={styles.intro}>
          <Text variant="title" accessibilityRole="header">
            Your meals
          </Text>
          <Text variant="small" color="textSecondary">
            Tap + to add everything to {MEAL_LABEL[slot].toLowerCase()}.
          </Text>
        </View>
        {meals.isPending ? <ActivityIndicator color={colors.accent} /> : null}
        {meals.error ? (
          <EmptyState
            icon="bookmark"
            title="Couldn’t load your meals"
            body={loadErrorMessage(meals.error, 'Check your internet connection, then close this and open it again.')}
          />
        ) : null}
        {meals.data && meals.data.length === 0 ? (
          <EmptyState
            icon="bookmark"
            title="No saved meals yet"
            body="Log a meal you eat often, then on the Food log tap ⋯ on that meal and choose Save as a meal. After that, it’s one tap here."
          />
        ) : null}
        <View>
          {(meals.data ?? []).map((m, i) => (
            <FoodRow
              key={m.id}
              first={i === 0}
              name={m.name}
              detail={`${mealSummary(m.items.length, m.totals.kcal).split(' · ')[0]} · ${m.items
                .slice(0, 3)
                .map((x) => x.name)
                .join(', ')}`}
              kcal={m.totals.kcal}
              macros={{ p: m.totals.protein_g, c: m.totals.carbs_g, f: m.totals.fat_g }}
              onPress={() => router.push({ pathname: '/meal/[id]', params: { id: m.id, date, meal: slot } })}
              onAdd={() => add(m)}
            />
          ))}
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
