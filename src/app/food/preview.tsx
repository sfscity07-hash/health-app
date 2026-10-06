import { router, useLocalSearchParams } from 'expo-router';

import { EditorStatus } from '@/components/food/EditorStatus';
import { FoodDetail, type PortionChoice } from '@/components/food/FoodDetail';
import { useLogFood } from '@/features/food/api';
import { useDayBudget } from '@/features/food/useDayBudget';
import { useFoundFoods } from '@/features/search/api';
import { asFood } from '@/features/search/types';
import { formatInt } from '@/lib/format';
import { success } from '@/lib/haptics';
import { isMeal, mealForTime } from '@/lib/meals';
import { useViewedDate } from '@/store/day';
import { useToast } from '@/store/toast';

type Params = { key: string; date?: string; meal?: string };

/**
 * A food from the USDA or Open Food Facts search. It opens instantly from the
 * search result and is saved to your account only when you add it.
 */
export default function FoundFoodScreen() {
  const params = useLocalSearchParams<Params>();
  const viewedDay = useViewedDate();
  const date = params.date || viewedDay;
  const found = useFoundFoods((s) => s.foods[params.key]);
  const logFood = useLogFood();
  const showToast = useToast((s) => s.show);
  const { eaten, targets } = useDayBudget(date);
  const close = () => router.back();

  if (!found) {
    return (
      <EditorStatus
        title="Food"
        onClose={close}
        problem={{ title: 'This search result has expired', body: 'Go back and search for it again.' }}
      />
    );
  }

  function add(c: PortionChoice) {
    logFood.mutate({
      date,
      meal: c.meal,
      foodId: null,
      external: found,
      name: found.name,
      brand: found.brand,
      quantity: c.qty,
      unit: c.unit.label,
      grams: c.grams,
      nutrients: c.nutrients,
    });
    success();
    showToast(`Added ${found.name} · ${formatInt(c.nutrients.kcal)} kcal`);
    close();
  }

  return (
    <FoodDetail
      food={asFood(found)}
      mode="add"
      initialMeal={isMeal(params.meal) ? params.meal : mealForTime(new Date())}
      before={eaten}
      targets={targets}
      saving={false}
      onClose={close}
      onSubmit={add}
    />
  );
}
