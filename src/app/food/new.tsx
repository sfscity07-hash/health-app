import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { EditorFooter } from '@/components/food/EditorFooter';
import { ModalHeader } from '@/components/food/ModalHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage } from '@/features/auth/errors';
import { useCreateFood } from '@/features/food/api';
import { buildCustomFood, UNIT_SUGGESTIONS, type CustomFoodForm, type LabelField, type UnitDraft } from '@/features/food/forms';
import { useScannedIngredient } from '@/features/recipes/draft';
import { isMillilitres } from '@/lib/portion';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { gutter, radius, space } from '@/theme/tokens';

/** `for: 'recipe'`: made from a recipe's barcode scan, so it goes into that recipe once saved. */
type Params = { date?: string; meal?: string; name?: string; barcode?: string; for?: string };

type Numbers = Pick<CustomFoodForm, 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber'>;

/** The label extras, two to a row, in the order labels list them. */
const LABEL_ROWS: { key: LabelField; label: string; unit: string }[][] = [
  [
    { key: 'saturated_fat_g', label: 'Saturated fat', unit: 'g' },
    { key: 'sugar_g', label: 'Sugar', unit: 'g' },
  ],
  [
    { key: 'sodium_mg', label: 'Sodium', unit: 'mg' },
    { key: 'cholesterol_mg', label: 'Cholesterol', unit: 'mg' },
  ],
  [
    { key: 'caffeine_mg', label: 'Caffeine', unit: 'mg' },
    { key: 'calcium_mg', label: 'Calcium', unit: 'mg' },
  ],
  [
    { key: 'iron_mg', label: 'Iron', unit: 'mg' },
    { key: 'potassium_mg', label: 'Potassium', unit: 'mg' },
  ],
];

/** Create a food from its nutrition label, measured however you like (scoop, cup, ml…), then pick how much you had. */
export default function NewFoodScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<Params>();
  const createFood = useCreateFood();
  const showToast = useToast((s) => s.show);

  const [name, setName] = useState(params.name ?? '');
  const [brand, setBrand] = useState('');
  /** "g" for grams only, a suggested unit, or "other" for a name you type. */
  const [choice, setChoice] = useState('g');
  const [customUnit, setCustomUnit] = useState('');
  const [unitGrams, setUnitGrams] = useState('');
  const [basis, setBasis] = useState<'unit' | '100'>('unit');
  const [numbers, setNumbers] = useState<Numbers>({ kcal: '', protein: '', carbs: '', fat: '', fiber: '' });
  const [extraUnits, setExtraUnits] = useState<UnitDraft[]>([]);
  const [label, setLabel] = useState<Partial<Record<LabelField, string>>>({});
  const [showLabel, setShowLabel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unit = choice === 'other' ? customUnit.trim().toLowerCase() : choice;
  const byWeight = choice === 'g';
  const ml = isMillilitres(unit);
  const counted = !byWeight && !ml;
  const unitWord = unit || 'unit';
  const per = byWeight ? 'per 100 g' : ml ? 'per 100 ml' : basis === '100' ? 'per 100 g' : `per ${unitWord}`;

  const changed = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setError(null);
  };
  const setNumber = (key: keyof Numbers) => (v: string) => {
    setNumbers((n) => ({ ...n, [key]: v }));
    setError(null);
  };

  function pickUnit(value: string) {
    setChoice(value);
    setError(null);
    // Most drinks weigh about a gram per millilitre.
    if (isMillilitres(value) && unitGrams === '') setUnitGrams('1');
  }

  const setExtra = (i: number, patch: Partial<UnitDraft>) => {
    setExtraUnits((list) => list.map((u, j) => (j === i ? { ...u, ...patch } : u)));
    setError(null);
  };

  async function save() {
    const built = buildCustomFood({ name, brand, unit, unitGrams, basis, extraUnits, label, barcode: params.barcode, ...numbers });
    if (!built.ok) {
      setError(built.error);
      return;
    }
    try {
      const food = await createFood.mutateAsync({ food: built.food, servings: built.servings });
      showToast(`Saved ${food.name} to your foods`);
      if (params.for === 'recipe') {
        // Back to the ingredient picker, which opens it to pick the amount.
        useScannedIngredient.getState().put({ kind: 'saved', id: food.id });
        router.back();
      } else {
        router.replace({ pathname: '/food/[id]', params: { id: food.id, date: params.date ?? '', meal: params.meal ?? '' } });
      }
    } catch (e) {
      setError(authErrorMessage(e));
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader title="New food" onClose={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text variant="title" accessibilityRole="header">
            Copy the label
          </Text>
          <Text variant="small" color="textSecondary">
            Enter the numbers the way the package shows them. It’s saved to your foods for next time.
          </Text>
          {params.barcode ? (
            <View style={[styles.barcode, { backgroundColor: colors.accentSoft }]}>
              <Icon name="scan" size={15} color="accent" />
              <Text variant="caption" color="text" style={styles.barcodeText}>
                Barcode {params.barcode} is saved with it, so scanning this package finds it straight away next time.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.group}>
          <TextField label="Name" value={name} onChangeText={changed(setName)} placeholder="e.g. Whey protein" autoFocus={!params.name} maxLength={200} />
          <TextField label="Brand (optional)" value={brand} onChangeText={changed(setBrand)} placeholder="e.g. Optimum Nutrition" maxLength={120} />
        </View>

        <Card style={styles.card}>
          <Text variant="label">How do you measure it?</Text>
          <ChipGroup label="Unit">
            <Chip label="grams" selected={choice === 'g'} onPress={() => pickUnit('g')} />
            {UNIT_SUGGESTIONS.map((u) => (
              <Chip key={u} label={u} selected={choice === u} onPress={() => pickUnit(u)} />
            ))}
            <Chip label="Other…" selected={choice === 'other'} onPress={() => pickUnit('other')} />
          </ChipGroup>

          {choice === 'other' ? (
            <TextField
              label="Unit name"
              value={customUnit}
              onChangeText={changed(setCustomUnit)}
              placeholder="e.g. handful, glass, sachet"
              autoCapitalize="none"
              autoFocus
              maxLength={40}
            />
          ) : null}

          {!byWeight ? (
            <TextField
              label={ml ? '1 ml weighs' : `1 ${unitWord} weighs`}
              suffix="g"
              value={unitGrams}
              onChangeText={changed(setUnitGrams)}
              keyboardType="decimal-pad"
              placeholder={ml ? '1' : 'e.g. 30'}
            />
          ) : null}

          {counted ? (
            <View style={styles.group}>
              <Text variant="caption" color="textSecondary">
                The label’s numbers are
              </Text>
              <SegmentedControl
                label="The label's numbers are"
                options={[
                  { value: 'unit', label: `Per ${unitWord}` },
                  { value: '100', label: 'Per 100 g' },
                ]}
                value={basis}
                onChange={changed(setBasis)}
              />
            </View>
          ) : null}

          <Text variant="caption" color="textTertiary">
            {byWeight
              ? 'You’ll log it in grams or ounces. Pick a unit above to log it by the scoop, cup or slice instead.'
              : ml
                ? 'Most drinks are about 1 g per ml; milk is 1.03. You’ll log it in ml.'
                : `The label usually says it, like “1 ${unitWord} (30 g)”. You can still log in grams too.`}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text variant="label">Nutrition {per}</Text>
          <TextField label="Calories" suffix="kcal" value={numbers.kcal} onChangeText={setNumber('kcal')} keyboardType="decimal-pad" placeholder="0" />
          <View style={styles.row}>
            <TextField label="Protein" suffix="g" flex value={numbers.protein} onChangeText={setNumber('protein')} keyboardType="decimal-pad" placeholder="0" />
            <TextField label="Carbs" suffix="g" flex value={numbers.carbs} onChangeText={setNumber('carbs')} keyboardType="decimal-pad" placeholder="0" />
          </View>
          <View style={styles.row}>
            <TextField label="Fat" suffix="g" flex value={numbers.fat} onChangeText={setNumber('fat')} keyboardType="decimal-pad" placeholder="0" />
            <TextField label="Fibre" suffix="g" flex value={numbers.fiber} onChangeText={setNumber('fiber')} keyboardType="decimal-pad" placeholder="0" />
          </View>
          {showLabel ? (
            <>
              <Text variant="caption" color="textTertiary">
                Fill in what the label lists ({per}); leave the rest empty. Salt in grams? Sodium is salt × 400 in mg (1.2 g salt = 480 mg).
              </Text>
              {LABEL_ROWS.map((row) => (
                <View key={row[0].key} style={styles.row}>
                  {row.map((f) => (
                    <TextField
                      key={f.key}
                      label={`${f.label} (${f.unit})`}
                      suffix={f.unit}
                      flex
                      value={label[f.key] ?? ''}
                      onChangeText={(v) => {
                        setLabel((l) => ({ ...l, [f.key]: v }));
                        setError(null);
                      }}
                      keyboardType="decimal-pad"
                      placeholder="–"
                    />
                  ))}
                </View>
              ))}
            </>
          ) : (
            <Button label="Add salt, sugar, caffeine and more" icon="plus" variant="ghost" onPress={() => setShowLabel(true)} />
          )}
        </Card>

        <Card style={styles.card}>
          <Text variant="label">More units (optional)</Text>
          <Text variant="caption" color="textTertiary">
            Other ways you measure it, like 1 tbsp = 10 g. You can pick any of them when you log.
          </Text>
          {extraUnits.map((u, i) => (
            <View key={i} style={styles.extraRow}>
              <TextField
                label="Unit"
                flex
                value={u.label}
                onChangeText={(v) => setExtra(i, { label: v })}
                placeholder="tbsp"
                autoCapitalize="none"
                maxLength={40}
              />
              <TextField
                label="Weighs"
                flex
                suffix="g"
                value={u.grams}
                onChangeText={(v) => setExtra(i, { grams: v })}
                keyboardType="decimal-pad"
                placeholder="10"
              />
              <View style={styles.remove}>
                <IconButton icon="close" label={`Remove ${u.label || 'unit'}`} size={36} onPress={() => setExtraUnits((list) => list.filter((_, j) => j !== i))} />
              </View>
            </View>
          ))}
          <Button
            label={extraUnits.length ? 'Add another unit' : 'Add a unit'}
            icon="plus"
            variant="ghost"
            onPress={() => setExtraUnits((list) => [...list, { label: '', grams: '' }])}
          />
        </Card>
      </ScrollView>

      <EditorFooter label="Save food" onPress={save} loading={createFood.isPending} error={error} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxl, gap: space.xl },
  intro: { gap: space.xs, marginTop: space.sm },
  group: { gap: space.sm },
  card: { padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  extraRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' },
  remove: { paddingBottom: 9 },
  barcode: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, marginTop: space.xs },
  barcodeText: { flex: 1 },
});
