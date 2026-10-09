import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditorFooter } from '@/components/food/EditorFooter';
import { EditorStatus } from '@/components/food/EditorStatus';
import { MacroMix } from '@/components/food/MacroMix';
import { ModalHeader } from '@/components/food/ModalHeader';
import { ActionSheet, type SheetAction } from '@/components/ui/ActionSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { ToastHost } from '@/components/ui/ToastHost';
import { authErrorMessage } from '@/features/auth/errors';
import { parseNumber } from '@/features/onboarding/draft';
import { useDeleteRecipe, useRecipe, useSaveRecipe } from '@/features/recipes/api';
import { useRecipeDraft } from '@/features/recipes/draft';
import { copyName, describeItem, emptyDraft, finishedWeight, per100, perServing, rawWeight, recipeProblem, totals, type RecipeItem } from '@/features/recipes/logic';
import { formatInt } from '@/lib/format';
import { success, tap, tick } from '@/lib/haptics';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { gutter, radius, space } from '@/theme/tokens';

type Params = { id?: string; date?: string; meal?: string; from?: string };

const g = (n: number) => (n > 0 && n < 10 ? n.toFixed(1) : String(Math.round(n)));

/** Build a recipe from ingredients, weigh the finished dish if you like, and save it as a food you can log by the gram or the serving. */
export default function RecipeEditor() {
  const params = useLocalSearchParams<Params>();
  const loadKey = params.id ? `edit:${params.id}` : 'new';
  const saved = useRecipe(params.id);
  const draft = useRecipeDraft((s) => s.draft);
  const loadedFor = useRecipeDraft((s) => s.loadedFor);
  const start = useRecipeDraft((s) => s.start);

  // Load the recipe into the draft once; coming back from picking an ingredient keeps your changes.
  useEffect(() => {
    if (loadedFor === loadKey) return;
    if (!params.id) start(emptyDraft(), loadKey);
    else if (saved.data) start(saved.data, loadKey);
  }, [loadKey, loadedFor, params.id, saved.data, start]);

  // Closing the editor forgets the draft, so the next one starts fresh.
  useEffect(() => () => useRecipeDraft.getState().start(emptyDraft(), null), []);

  if (loadedFor !== loadKey) {
    if (saved.isError) {
      return <EditorStatus title="Recipe" onClose={() => router.back()} problem={{ title: 'Couldn’t open this recipe', body: authErrorMessage(saved.error) }} />;
    }
    return <EditorStatus title="Recipe" onClose={() => router.back()} />;
  }
  return <EditorForm params={params} draftId={draft.id} originalName={saved.data?.name ?? ''} />;
}

function EditorForm({ params, draftId, originalName }: { params: Params; draftId: string | null; originalName: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToast((s) => s.show);
  const draft = useRecipeDraft((s) => s.draft);
  const patch = useRecipeDraft((s) => s.patch);
  const removeItem = useRecipeDraft((s) => s.removeItem);
  const save = useSaveRecipe();
  const remove = useDeleteRecipe();
  const [menuFor, setMenuFor] = useState<RecipeItem | null>(null);
  const [weightText, setWeightText] = useState(draft.finalWeight ? String(draft.finalWeight) : '');
  const [error, setError] = useState<string | null>(null);

  const t = totals(draft.items);
  const raw = rawWeight(draft.items);
  const weight = finishedWeight(draft);
  const p100 = per100(draft);
  const pServing = perServing(draft);
  const problem = recipeProblem(draft);

  const openPicker = (mode: 'add' | 'swap' | 'amount', key?: string) => router.push({ pathname: '/recipe/pick', params: { mode, ...(key ? { key } : {}), ...(draftId ? { exclude: draftId } : {}) } });

  function setWeight(text: string) {
    setWeightText(text);
    setError(null);
    const v = parseNumber(text);
    patch({ finalWeight: v !== null && v > 0 ? v : null });
  }

  async function submit(asCopy = false) {
    if (problem) return setError(problem);
    // A new version keeps your new name; if you didn't rename it, it's marked as a copy.
    const toSave = asCopy ? { ...draft, id: null, name: draft.name.trim() === originalName.trim() ? copyName(draft.name) : draft.name } : draft;
    try {
      const id = await save.mutateAsync(toSave);
      success();
      showToast(`Saved ${toSave.name.trim()}`);
      if (params.date || params.meal) {
        // Opened from the logger: go straight on to logging some.
        router.replace({ pathname: '/food/[id]', params: { id, ...(params.date ? { date: params.date } : {}), ...(params.meal ? { meal: params.meal } : {}) } });
      } else {
        router.back();
      }
    } catch (e) {
      setError(authErrorMessage(e));
    }
  }

  function del() {
    if (!draft.id) return;
    remove.mutate({ id: draft.id });
    tap();
    showToast(`Deleted ${draft.name.trim()}`);
    // Opened from the recipe's own food screen: close that too, since the food is gone.
    if (params.from === 'food') router.dismiss(2);
    else router.back();
  }

  const menuActions = (item: RecipeItem): SheetAction[] =>
    item.food || item.external
      ? [
          { label: 'Change amount', icon: 'pencil', hint: describeItem(item), onPress: () => openPicker('amount', item.key) },
          { label: 'Swap for another food', icon: 'swap', hint: item.grams ? `Keeps the same ${Math.round(item.grams)} g` : 'Pick what to use instead', onPress: () => openPicker('swap', item.key) },
          { label: 'Remove', icon: 'trash', onPress: () => removeItem(item.key) },
        ]
      : [
          { label: 'Change', icon: 'pencil', hint: describeItem(item), onPress: () => router.push({ pathname: '/recipe/quick', params: { key: item.key } }) },
          { label: 'Swap for a food', icon: 'swap', onPress: () => openPicker('swap', item.key) },
          { label: 'Remove', icon: 'trash', onPress: () => removeItem(item.key) },
        ];

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader title={draft.id ? 'Edit recipe' : 'New recipe'} onClose={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <TextField
          label="Name"
          value={draft.name}
          onChangeText={(name) => {
            patch({ name });
            setError(null);
          }}
          placeholder="e.g. Paneer tikka marinade"
          maxLength={120}
        />

        <Card style={styles.totals}>
          <Text variant="label">Whole batch</Text>
          <View style={styles.kcalRow}>
            <Text variant="hero" tabular>
              {formatInt(t.kcal)}
            </Text>
            <Text variant="body" color="textSecondary">
              kcal
            </Text>
            <View style={styles.flex} />
            <MacroMix p={t.protein_g} c={t.carbs_g} f={t.fat_g} width={56} />
          </View>
          <Text variant="small" color="textSecondary" tabular>
            <Text variant="small" color="protein">
              Protein
            </Text>{' '}
            {g(t.protein_g)} g ·{' '}
            <Text variant="small" color="carbs">
              Carbs
            </Text>{' '}
            {g(t.carbs_g)} g ·{' '}
            <Text variant="small" color="fat">
              Fat
            </Text>{' '}
            {g(t.fat_g)} g ·{' '}
            <Text variant="small" color="fiber">
              Fibre
            </Text>{' '}
            {g(t.fiber_g)} g
          </Text>
          <View style={[styles.perRow, { borderTopColor: colors.hairline }]}>
            <View style={styles.per}>
              <Text variant="caption" color="textSecondary">
                Weighs
              </Text>
              <Text variant="bodyStrong" tabular>
                {weight > 0 ? `${formatInt(weight)} g` : '–'}
              </Text>
            </View>
            <View style={styles.per}>
              <Text variant="caption" color="textSecondary">
                Per 100 g
              </Text>
              <Text variant="bodyStrong" tabular>
                {p100 ? `${formatInt(p100.kcal)} kcal` : '–'}
              </Text>
            </View>
            <View style={styles.per}>
              <Text variant="caption" color="textSecondary">
                {draft.servings ? `Per serving (${draft.servings})` : 'Per serving'}
              </Text>
              <Text variant="bodyStrong" tabular>
                {pServing ? `${formatInt(pServing.kcal)} kcal` : '–'}
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text variant="label">Ingredients</Text>
            <Text variant="label">kcal</Text>
          </View>
          {draft.items.length === 0 ? (
            <Text variant="small" color="textSecondary">
              Add everything that went in: your foods, anything from the food database, even another recipe. Tap an ingredient later to change its amount or swap it.
            </Text>
          ) : (
            <Card style={styles.list}>
              {draft.items.map((i, n) => (
                <PressableScale
                  key={i.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${i.name}, ${describeItem(i)}, ${formatInt(i.nutrients.kcal)} calories. Tap to change, swap or remove.`}
                  pressedScale={0.985}
                  onPress={() => {
                    tick();
                    setMenuFor(i);
                  }}
                  style={[styles.item, n > 0 && { borderTopColor: colors.hairline, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
                  <View style={styles.itemText}>
                    <Text variant="body" numberOfLines={1}>
                      {i.name}
                    </Text>
                    <Text variant="caption" color="textTertiary" numberOfLines={1}>
                      {describeItem(i)}
                      {i.brand ? ` · ${i.brand}` : ''}
                    </Text>
                  </View>
                  <View style={styles.itemKcal}>
                    <Text variant="smallStrong" color="textSecondary" tabular>
                      {formatInt(i.nutrients.kcal)}
                    </Text>
                    <MacroMix p={i.nutrients.protein_g} c={i.nutrients.carbs_g} f={i.nutrients.fat_g} width={24} />
                  </View>
                </PressableScale>
              ))}
            </Card>
          )}
          <Button label="Add ingredient" icon="plus" variant="secondary" onPress={() => openPicker('add')} />
          <Button label="Quick ingredient (just the numbers)" variant="ghost" onPress={() => router.push('/recipe/quick')} />
        </View>

        <View style={styles.section}>
          <Text variant="label">Finished weight</Text>
          <TextField
            label="What the finished dish weighs (optional)"
            value={weightText}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            suffix="g"
            placeholder={raw > 0 ? String(Math.round(raw)) : 'e.g. 640'}
          />
          <Text variant="caption" color="textSecondary">
            {draft.finalWeight
              ? `Cooking changed the weight from ${formatInt(raw)} g to ${formatInt(draft.finalWeight)} g, so 100 g of the finished dish has ${p100 ? formatInt(p100.kcal) : '–'} kcal.`
              : `Leave it empty to use what the ingredients add up to (${formatInt(raw)} g). Cooking drives off water, so if you weigh the finished dish (without the pot), every gram you log is exact.`}
          </Text>
        </View>

        <Stepper
          label="Servings"
          value={draft.servings ? `${draft.servings}` : 'Not set'}
          hint={draft.servings && weight > 0 ? `${formatInt(weight / draft.servings)} g each` : 'Adds a “serving” unit'}
          onMinus={() => {
            tick();
            patch({ servings: draft.servings && draft.servings > 1 ? draft.servings - 1 : null });
          }}
          onPlus={() => {
            tick();
            patch({ servings: (draft.servings ?? 0) + 1 });
          }}
          minDisabled={!draft.servings}
        />

        {draft.id ? (
          <Card style={styles.copyCard}>
            <Text variant="bodyStrong">Make a version of it</Text>
            <Text variant="small" color="textSecondary">
              Swap an ingredient (say, paneer for soya chaap), rename it, then save it as a new recipe. This one stays as it is.
            </Text>
            <Button label="Save as a new recipe" icon="copy" variant="secondary" onPress={() => submit(true)} disabled={save.isPending} />
          </Card>
        ) : null}
      </ScrollView>

      <EditorFooter
        label="Save recipe"
        trailing={p100 ? `${formatInt(p100.kcal)} kcal / 100 g` : undefined}
        onPress={() => submit(false)}
        loading={save.isPending}
        error={error}
        onDelete={draft.id ? del : undefined}
        deleteLabel="Delete recipe"
      />

      <ActionSheet
        visible={menuFor !== null}
        title={menuFor?.name ?? ''}
        subtitle={menuFor ? `${describeItem(menuFor)} · ${formatInt(menuFor.nutrients.kcal)} kcal` : undefined}
        actions={menuFor ? menuActions(menuFor) : []}
        onClose={() => setMenuFor(null)}
      />
      {/* Above the footer: "Added ghee", "Swapped paneer for soya chaap". */}
      <ToastHost bottom={insets.bottom + (draft.id ? 160 : 100)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxl, paddingTop: space.sm, gap: space.xl },
  totals: { padding: space.lg, gap: space.sm },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  perRow: { flexDirection: 'row', paddingTop: space.md, marginTop: space.xs, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  per: { flex: 1, gap: 2 },
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: space.xs },
  list: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  itemText: { flex: 1, minWidth: 0, gap: 2 },
  itemKcal: { alignItems: 'flex-end', gap: 5 },
  copyCard: { padding: space.lg, gap: space.sm, borderRadius: radius.lg },
});
