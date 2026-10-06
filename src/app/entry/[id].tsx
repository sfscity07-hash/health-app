import { router, useLocalSearchParams } from 'expo-router';

import { EditorStatus } from '@/components/food/EditorStatus';
import { FoodDetail, type PortionChoice } from '@/components/food/FoodDetail';
import { QuickAddForm, type QuickAddChoice } from '@/components/food/QuickAddForm';
import { useDeleteEntry, useEntry, useFavorites, useFood, useToggleFavorite, useUpdateEntry } from '@/features/food/api';
import { useDayBudget } from '@/features/food/useDayBudget';
import { formatQty, type Nutrients } from '@/lib/portion';
import { tap } from '@/lib/haptics';
import { useToast } from '@/store/toast';

const minus = (a: Nutrients, b: Nutrients): Nutrients => ({
  kcal: Math.max(0, a.kcal - b.kcal),
  protein_g: Math.max(0, a.protein_g - b.protein_g),
  carbs_g: Math.max(0, a.carbs_g - b.carbs_g),
  fat_g: Math.max(0, a.fat_g - b.fat_g),
  fiber_g: Math.max(0, a.fiber_g - b.fiber_g),
});

/** Change or delete something you've logged. */
export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useEntry(id);
  const foodId = entry.data?.food_id ?? undefined;
  const food = useFood(foodId);
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const showToast = useToast((s) => s.show);
  const { eaten, targets } = useDayBudget(entry.data?.log_date ?? '');
  const close = () => router.back();

  if (entry.isPending || (foodId && food.isPending)) return <EditorStatus title="Edit entry" onClose={close} />;
  if (entry.isError) {
    return (
      <EditorStatus
        title="Edit entry"
        onClose={close}
        problem={{ title: 'Couldn’t open this entry', body: 'It may have been deleted on another device, or you’re offline.' }}
      />
    );
  }

  const e = entry.data;
  const before = minus(eaten, e);

  function del() {
    remove.mutate({ id: e.id, date: e.log_date });
    tap();
    showToast(`Deleted ${e.name}`);
    close();
  }

  function saved() {
    tap();
    showToast('Saved changes');
    close();
  }

  // Entries from a food you can still open get the full portion editor.
  if (foodId && food.data) {
    const f = food.data;
    const favorite = favorites.data?.includes(f.id) ?? false;
    const save = (c: PortionChoice) => {
      update.mutate({
        id: e.id,
        date: e.log_date,
        meal: c.meal,
        name: e.name,
        quantity: c.qty,
        unit: c.unit.label,
        grams: c.grams,
        nutrients: c.nutrients,
      });
      saved();
    };
    return (
      <FoodDetail
        food={f}
        mode="edit"
        initialUnit={e.unit}
        initialQty={e.quantity}
        initialMeal={e.meal}
        before={before}
        targets={targets}
        saving={false}
        onClose={close}
        onSubmit={save}
        onDelete={del}
        favorite={favorite}
        onToggleFavorite={() => toggleFavorite.mutate({ foodId: f.id, on: !favorite })}
      />
    );
  }

  // Quick adds, and entries whose food was deleted, are edited as plain numbers.
  const save = (c: QuickAddChoice) => {
    update.mutate({
      id: e.id,
      date: e.log_date,
      meal: c.meal,
      name: c.name,
      quantity: e.quantity,
      unit: e.unit,
      grams: e.grams,
      nutrients: c.nutrients,
    });
    saved();
  };
  const field = (v: number) => (v > 0 ? formatQty(v) : '');
  return (
    <QuickAddForm
      mode="edit"
      initial={{
        name: e.name,
        kcal: formatQty(e.kcal),
        protein: field(e.protein_g),
        carbs: field(e.carbs_g),
        fat: field(e.fat_g),
        fiber: field(e.fiber_g),
      }}
      initialMeal={e.meal}
      before={before}
      targets={targets}
      onClose={close}
      onSubmit={save}
      onDelete={del}
    />
  );
}
