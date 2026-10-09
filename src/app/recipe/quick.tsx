import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { EditorFooter } from '@/components/food/EditorFooter';
import { ModalHeader } from '@/components/food/ModalHeader';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { parseNumber } from '@/features/onboarding/draft';
import { useRecipeDraft } from '@/features/recipes/draft';
import { quickItem } from '@/features/recipes/logic';
import { formatInt } from '@/lib/format';
import { success } from '@/lib/haptics';
import { kcalFromMacros } from '@/lib/portion';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';

const text = (n: number | undefined) => (n ? String(Math.round(n * 10) / 10) : '');

/** An ingredient that's just numbers: a spice mix, a splash of oil you know the calories of. */
export default function QuickIngredient() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ key?: string }>();
  const existing = useRecipeDraft((s) => s.draft.items.find((i) => i.key === params.key));
  const addItem = useRecipeDraft((s) => s.addItem);
  const replaceItem = useRecipeDraft((s) => s.replaceItem);
  const [name, setName] = useState(existing?.name ?? '');
  const [grams, setGrams] = useState(existing?.grams ? String(existing.grams) : '');
  const [kcal, setKcal] = useState(text(existing?.nutrients.kcal));
  const [protein, setProtein] = useState(text(existing?.nutrients.protein_g));
  const [carbs, setCarbs] = useState(text(existing?.nutrients.carbs_g));
  const [fat, setFat] = useState(text(existing?.nutrients.fat_g));
  const [fiber, setFiber] = useState(text(existing?.nutrients.fiber_g));
  const [error, setError] = useState<string | null>(null);

  const n = (s: string) => parseNumber(s) ?? 0;
  const fromMacros = kcalFromMacros(n(protein), n(carbs), n(fat));
  const energy = kcal.trim() ? n(kcal) : fromMacros;

  function save() {
    if (!name.trim()) return setError('Give it a name, e.g. “Spice mix”.');
    if (kcal.trim() && parseNumber(kcal) === null) return setError('Calories should be a number.');
    if (energy <= 0 && !grams.trim()) return setError('Enter its calories (or its macros).');
    const w = grams.trim() ? parseNumber(grams) : null;
    if (grams.trim() && (w === null || w <= 0)) return setError('Weight should be a number of grams, or leave it empty.');
    const item = quickItem(name.trim(), { kcal: energy, protein_g: n(protein), carbs_g: n(carbs), fat_g: n(fat), fiber_g: n(fiber) }, w);
    if (existing) replaceItem(existing.key, item);
    else addItem(item);
    success();
    router.back();
  }

  const field = (label: string, value: string, set: (v: string) => void, suffix: string) => (
    <TextField
      label={label}
      value={value}
      onChangeText={(v) => {
        set(v);
        setError(null);
      }}
      keyboardType="decimal-pad"
      suffix={suffix}
      flex
    />
  );

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader title="Quick ingredient" onClose={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text variant="small" color="textSecondary">
          For something that isn’t a food in Fuel. Its weight is optional; with it, the recipe’s finished weight includes it.
        </Text>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Tandoori spice mix" maxLength={120} autoFocus={!existing} />
        <View style={styles.row}>
          {field('Calories', kcal, setKcal, 'kcal')}
          {field('Weight (optional)', grams, setGrams, 'g')}
        </View>
        <View style={styles.row}>
          {field('Protein', protein, setProtein, 'g')}
          {field('Carbs', carbs, setCarbs, 'g')}
        </View>
        <View style={styles.row}>
          {field('Fat', fat, setFat, 'g')}
          {field('Fibre', fiber, setFiber, 'g')}
        </View>
        {!kcal.trim() && fromMacros > 0 ? (
          <Text variant="caption" color="textSecondary">
            Calories from the macros: {formatInt(fromMacros)} kcal
          </Text>
        ) : null}
      </ScrollView>
      <EditorFooter label={existing ? 'Update ingredient' : 'Add to recipe'} trailing={`${formatInt(energy)} kcal`} onPress={save} error={error} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxl, paddingTop: space.sm, gap: space.lg },
  row: { flexDirection: 'row', gap: space.md },
});
