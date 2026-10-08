import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { EditorFooter } from '@/components/food/EditorFooter';
import { EditorStatus } from '@/components/food/EditorStatus';
import { MacroMix } from '@/components/food/MacroMix';
import { ModalHeader } from '@/components/food/ModalHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useLogEntries } from '@/features/food/api';
import { useDeleteSavedMeal, useRemoveMealItem, useRenameSavedMeal, useSavedMeals } from '@/features/meals/api';
import { entriesFromMeal, mealSummary } from '@/features/meals/logic';
import { formatInt } from '@/lib/format';
import { success, tap } from '@/lib/haptics';
import { isMeal, MEAL_LABEL, MEAL_OPTIONS, mealForTime, type Meal } from '@/lib/meals';
import { describeLogged } from '@/lib/portion';
import { useViewedDate } from '@/store/day';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';

const grams = (g: number) => (g > 0 && g < 10 ? g.toFixed(1) : String(Math.round(g)));

/** One saved meal: what's in it, its totals, and adding it all to a meal. */
export default function SavedMealScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; date?: string; meal?: string }>();
  const viewed = useViewedDate();
  const date = params.date || viewed;
  const meals = useSavedMeals();
  const logEntries = useLogEntries();
  const rename = useRenameSavedMeal();
  const remove = useDeleteSavedMeal();
  const removeItem = useRemoveMealItem();
  const showToast = useToast((s) => s.show);
  const [slot, setSlot] = useState<Meal>(isMeal(params.meal) ? params.meal : mealForTime(new Date()));
  const [editing, setEditing] = useState<string | null>(null);
  const close = () => router.back();

  const meal = meals.data?.find((m) => m.id === params.id);
  if (meals.isPending) return <EditorStatus title="Saved meal" onClose={close} />;
  if (!meal) {
    return <EditorStatus title="Saved meal" onClose={close} problem={{ title: 'This meal was deleted', body: 'Go back to see your saved meals.' }} />;
  }
  const m = meal;
  const t = m.totals;

  function add() {
    logEntries.mutate(entriesFromMeal(m, date, slot));
    success();
    showToast(`Added ${m.name} · ${formatInt(t.kcal)} kcal`);
    close();
  }

  function saveName() {
    if (editing !== null && editing.trim()) rename.mutate({ id: m.id, name: editing });
    setEditing(null);
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader title="Saved meal" onClose={close} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {editing !== null ? (
          <View style={styles.renameRow}>
            <TextField label="Name" value={editing} onChangeText={setEditing} autoFocus maxLength={80} onSubmitEditing={saveName} flex />
            <Button label="Done" variant="ghost" onPress={saveName} />
          </View>
        ) : (
          <PressableScale accessibilityRole="button" accessibilityLabel={`${m.name}. Tap to rename.`} ripple={null} pressedScale={0.98} onPress={() => setEditing(m.name)}>
            <Text variant="title" accessibilityRole="header">
              {m.name}
            </Text>
            <Text variant="caption" color="textSecondary">
              {mealSummary(m.items.length, t.kcal)} · tap the name to rename
            </Text>
          </PressableScale>
        )}

        <Card style={styles.totals}>
          <View style={styles.kcalRow}>
            <Text variant="hero" tabular>
              {formatInt(t.kcal)}
            </Text>
            <Text variant="body" color="textSecondary">
              kcal
            </Text>
          </View>
          <Text variant="small" color="textSecondary" tabular>
            <Text variant="small" color="protein">
              Protein
            </Text>{' '}
            {grams(t.protein_g)} g ·{' '}
            <Text variant="small" color="carbs">
              Carbs
            </Text>{' '}
            {grams(t.carbs_g)} g ·{' '}
            <Text variant="small" color="fat">
              Fat
            </Text>{' '}
            {grams(t.fat_g)} g ·{' '}
            <Text variant="small" color="fiber">
              Fibre
            </Text>{' '}
            {grams(t.fiber_g)} g
          </Text>
        </Card>

        <Card style={styles.list}>
          {m.items.map((i, n) => (
            <View key={i.id} style={[styles.row, n > 0 && { borderTopColor: colors.hairline, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
              <View style={styles.rowText}>
                <Text variant="body" numberOfLines={1}>
                  {i.name}
                </Text>
                <Text variant="caption" color="textTertiary">
                  {i.food ? describeLogged(i.quantity, i.unit, i.grams) : 'Quick add'}
                </Text>
              </View>
              <View style={styles.kcal}>
                <Text variant="smallStrong" color="textSecondary" tabular>
                  {formatInt(i.nutrients.kcal)}
                </Text>
                <MacroMix p={i.nutrients.protein_g} c={i.nutrients.carbs_g} f={i.nutrients.fat_g} width={24} />
              </View>
              {m.items.length > 1 ? (
                <IconButton
                  icon="close"
                  label={`Remove ${i.name} from this meal`}
                  size={30}
                  onPress={() => {
                    tap();
                    removeItem.mutate({ mealId: m.id, itemId: i.id });
                  }}
                />
              ) : null}
            </View>
          ))}
        </Card>

        <View style={styles.group}>
          <Text variant="caption" color="textSecondary">
            Add to
          </Text>
          <SegmentedControl label="Meal" options={MEAL_OPTIONS} value={slot} onChange={setSlot} />
        </View>
      </ScrollView>

      <EditorFooter
        label={`Add to ${MEAL_LABEL[slot]}`}
        trailing={`${formatInt(t.kcal)} kcal`}
        onPress={add}
        onDelete={() => {
          remove.mutate({ id: m.id });
          showToast(`Deleted “${m.name}”`);
          close();
        }}
        deleteLabel="Delete saved meal"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxl, paddingTop: space.sm, gap: space.xl },
  renameRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  totals: { padding: space.lg, gap: space.xs },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  list: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  kcal: { alignItems: 'flex-end', gap: 5 },
  group: { gap: space.sm },
});
