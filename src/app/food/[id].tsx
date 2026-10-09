import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditorStatus } from '@/components/food/EditorStatus';
import { FoodDetail, type PortionChoice } from '@/components/food/FoodDetail';
import { RecipeBanner } from '@/components/food/RecipeBanner';
import { RecipePortion } from '@/components/food/RecipePortion';
import { ToastHost } from '@/components/ui/ToastHost';
import { useAddUnit, useFavorites, useFood, useLogFood, useToggleFavorite } from '@/features/food/api';
import { useDayBudget } from '@/features/food/useDayBudget';
import { useRecipes } from '@/features/recipes/api';
import { formatInt } from '@/lib/format';
import { success } from '@/lib/haptics';
import { isMeal, mealForTime } from '@/lib/meals';
import { useViewedDate } from '@/store/day';
import { useToast } from '@/store/toast';

type Params = { id: string; date?: string; meal?: string; qty?: string; unit?: string };

/** A food you're about to log: pick the amount and meal, see what it does to your day. */
export default function FoodScreen() {
  const params = useLocalSearchParams<Params>();
  const viewedDay = useViewedDate();
  const insets = useSafeAreaInsets();
  const date = params.date || viewedDay;
  const food = useFood(params.id);
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const logFood = useLogFood();
  const addUnit = useAddUnit();
  const showToast = useToast((s) => s.show);
  const { eaten, targets } = useDayBudget(date);
  const recipes = useRecipes();
  const recipe = recipes.data?.find((r) => r.id === params.id);
  const close = () => router.back();

  if (food.isPending) return <EditorStatus title="Food" onClose={close} />;
  if (food.isError) {
    return (
      <EditorStatus
        title="Food"
        onClose={close}
        problem={{ title: 'Couldn’t open this food', body: 'It may have been deleted, or you’re offline. Go back and try again.' }}
      />
    );
  }

  const f = food.data;
  const favorite = favorites.data?.includes(f.id) ?? false;
  const qty = params.qty ? Number(params.qty) : undefined;

  function add(c: PortionChoice) {
    logFood.mutate({
      date,
      meal: c.meal,
      foodId: f.id,
      name: f.name,
      brand: f.brand,
      quantity: c.qty,
      unit: c.unit.label,
      grams: c.grams,
      nutrients: c.nutrients,
    });
    success();
    showToast(`Added ${f.name} · ${formatInt(c.nutrients.kcal)} kcal`);
    close();
  }

  return (
    <>
      <FoodDetail
        food={f}
        mode="add"
        initialUnit={params.unit}
        initialQty={qty !== undefined && Number.isFinite(qty) ? qty : undefined}
        initialMeal={isMeal(params.meal) ? params.meal : mealForTime(new Date())}
        before={eaten}
        targets={targets}
        saving={false}
        onClose={close}
        onSubmit={add}
        favorite={favorite}
        onToggleFavorite={() => toggleFavorite.mutate({ foodId: f.id, on: !favorite })}
        onAddUnit={(serving) => addUnit.mutate({ foodId: f.id, serving })}
        title={recipe ? 'Recipe' : undefined}
        recipe={Boolean(recipe)}
        banner={recipe ? <RecipeBanner count={recipe.itemCount} onEdit={() => router.push({ pathname: '/recipe/edit', params: { id: f.id, from: 'food' } })} /> : undefined}
        extra={recipe ? (portion) => <RecipePortion id={f.id} {...portion} /> : undefined}
      />
      {/* "Saved Paneer marinade" when a new recipe opens here. */}
      <ToastHost bottom={insets.bottom + 100} />
    </>
  );
}
