import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { EditorFooter } from '@/components/food/EditorFooter';
import { ImpactPreview } from '@/components/food/ImpactPreview';
import { ModalHeader } from '@/components/food/ModalHeader';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { parseQuickAdd, type QuickAddForm as Form } from '@/features/food/forms';
import { parseNumber } from '@/features/onboarding/draft';
import { formatInt } from '@/lib/format';
import { MEAL_LABEL, MEAL_OPTIONS, type Meal } from '@/lib/meals';
import { kcalFromMacros, type Nutrients } from '@/lib/portion';
import { useTheme } from '@/theme/theme';
import { fonts, gutter, space } from '@/theme/tokens';

const NONE: Nutrients = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
const EMPTY: Form = { name: '', kcal: '', protein: '', carbs: '', fat: '' };

export type QuickAddChoice = { meal: Meal; name: string; nutrients: Nutrients };

type QuickAddFormProps = {
  mode: 'add' | 'edit';
  initial?: Partial<Form>;
  initialMeal: Meal;
  before: Nutrients;
  targets: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  saving?: boolean;
  onClose: () => void;
  onSubmit: (choice: QuickAddChoice) => void;
  onDelete?: () => void;
  deleting?: boolean;
};

/** Calories and macros without a food behind them: restaurant meals, estimates, a label you can't scan. */
export function QuickAddForm(p: QuickAddFormProps) {
  const { colors } = useTheme();
  const [form, setForm] = useState<Form>(() => {
    const f = { ...EMPTY };
    for (const k of Object.keys(EMPTY) as (keyof Form)[]) f[k] = p.initial?.[k] ?? '';
    return f;
  });
  const [meal, setMeal] = useState<Meal>(p.initialMeal);
  const [showError, setShowError] = useState(false);
  const set = (key: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setShowError(false);
  };

  const parsed = parseQuickAdd(form);
  const macroKcal = kcalFromMacros(parseNumber(form.protein) ?? 0, parseNumber(form.carbs) ?? 0, parseNumber(form.fat) ?? 0);
  const kcal = parsed.ok ? parsed.nutrients.kcal : 0;

  function submit() {
    if (!parsed.ok) {
      setShowError(true);
      return;
    }
    p.onSubmit({ meal, name: parsed.name, nutrients: parsed.nutrients });
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader title={p.mode === 'edit' ? 'Edit entry' : 'Quick add'} onClose={p.onClose} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text variant="title" accessibilityRole="header">
            {p.mode === 'edit' ? form.name || 'Quick add' : 'Just the numbers'}
          </Text>
          <Text variant="small" color="textSecondary">
            For restaurant meals and estimates. Calories are enough; macros help your targets.
          </Text>
        </View>

        <Card style={styles.kcalCard}>
          <View style={styles.kcalRow}>
            <TextInput
              value={form.kcal}
              onChangeText={set('kcal')}
              placeholder={macroKcal > 0 ? String(Math.round(macroKcal)) : '0'}
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              autoFocus={p.mode === 'add'}
              accessibilityLabel="Calories"
              selectionColor={colors.accent}
              cursorColor={colors.accent}
              style={[styles.kcalInput, { color: colors.text }, Platform.OS === 'web' && styles.noWebOutline]}
            />
            <Text variant="body" color="textSecondary">
              kcal
            </Text>
          </View>
          <Text variant="label" align="center">
            {form.kcal.trim() === '' && macroKcal > 0 ? 'Worked out from your macros' : 'Calories'}
          </Text>
        </Card>

        <View style={styles.macros}>
          <TextField label="Protein" suffix="g" flex value={form.protein} onChangeText={set('protein')} keyboardType="decimal-pad" placeholder="0" />
          <TextField label="Carbs" suffix="g" flex value={form.carbs} onChangeText={set('carbs')} keyboardType="decimal-pad" placeholder="0" />
          <TextField label="Fat" suffix="g" flex value={form.fat} onChangeText={set('fat')} keyboardType="decimal-pad" placeholder="0" />
        </View>

        <TextField label="Name (optional)" value={form.name} onChangeText={set('name')} placeholder="e.g. Burrito bowl" maxLength={200} />

        <View style={styles.group}>
          <Text variant="caption" color="textSecondary">
            Meal
          </Text>
          <SegmentedControl label="Meal" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />
        </View>

        <ImpactPreview before={p.before} adding={parsed.ok ? parsed.nutrients : NONE} targets={p.targets} />
      </ScrollView>

      <EditorFooter
        label={p.mode === 'edit' ? 'Save changes' : `Add to ${MEAL_LABEL[meal]}`}
        trailing={kcal > 0 ? `${formatInt(kcal)} kcal` : undefined}
        loading={p.saving}
        error={showError && !parsed.ok ? parsed.error : null}
        onPress={submit}
        onDelete={p.onDelete}
        deleting={p.deleting}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxl, gap: space.xl },
  intro: { gap: space.xs, marginTop: space.sm },
  kcalCard: { paddingVertical: space.lg, paddingHorizontal: space.lg, gap: space.xs },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
  kcalInput: {
    minWidth: 90,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 44,
    letterSpacing: -2,
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  noWebOutline: { outlineWidth: 0 },
  macros: { flexDirection: 'row', gap: space.sm },
  group: { gap: space.sm },
});
