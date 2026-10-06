import { router, useLocalSearchParams } from 'expo-router';

import { QuickAddForm, type QuickAddChoice } from '@/components/food/QuickAddForm';
import { useLogFood } from '@/features/food/api';
import { useDayBudget } from '@/features/food/useDayBudget';
import { formatInt } from '@/lib/format';
import { success } from '@/lib/haptics';
import { isMeal, mealForTime } from '@/lib/meals';
import { useViewedDate } from '@/store/day';
import { useToast } from '@/store/toast';

type Params = { date?: string; meal?: string; name?: string; kcal?: string; protein?: string; carbs?: string; fat?: string; fiber?: string };

/** Quick add: log calories and macros directly. Opened from the logger (also to repeat an earlier quick add). */
export default function QuickAddScreen() {
  const params = useLocalSearchParams<Params>();
  const viewedDay = useViewedDate();
  const date = params.date ?? viewedDay;
  const { eaten, targets } = useDayBudget(date);
  const logFood = useLogFood();
  const showToast = useToast((s) => s.show);

  function add(c: QuickAddChoice) {
    logFood.mutate({
      date,
      meal: c.meal,
      foodId: null,
      name: c.name,
      brand: null,
      quantity: 1,
      unit: 'serving',
      grams: null,
      nutrients: c.nutrients,
    });
    success();
    showToast(`Added ${c.name} · ${formatInt(c.nutrients.kcal)} kcal`);
    router.back();
  }

  return (
    <QuickAddForm
      mode="add"
      initial={{ name: params.name, kcal: params.kcal, protein: params.protein, carbs: params.carbs, fat: params.fat, fiber: params.fiber }}
      initialMeal={isMeal(params.meal) ? params.meal : mealForTime(new Date())}
      before={eaten}
      targets={targets}
      onClose={() => router.back()}
      onSubmit={add}
    />
  );
}
