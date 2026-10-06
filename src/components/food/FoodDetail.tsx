import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { EditorFooter } from '@/components/food/EditorFooter';
import { ImpactPreview } from '@/components/food/ImpactPreview';
import { ModalHeader } from '@/components/food/ModalHeader';
import { PortionRuler } from '@/components/food/PortionRuler';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import type { FoodWithServings } from '@/features/food/api';
import { parseNumber } from '@/features/onboarding/draft';
import { formatInt } from '@/lib/format';
import { MEAL_LABEL, MEAL_OPTIONS, type Meal } from '@/lib/meals';
import { clampQty, formatQty, nutrientsFor, pluralize, unitsFor, type Nutrients, type PortionUnit } from '@/lib/portion';
import { useTheme } from '@/theme/theme';
import { fonts, gutter, radius, space } from '@/theme/tokens';

const SOURCE_LABEL = { custom: 'Your food', usda: 'USDA FoodData Central', off: 'Open Food Facts' } as const;

export type PortionChoice = { meal: Meal; qty: number; unit: PortionUnit; grams: number; nutrients: Nutrients };

type FoodDetailProps = {
  food: FoodWithServings;
  mode: 'add' | 'edit';
  /** Unit label ("g", "bar") and amount to start from, e.g. what you logged last time. */
  initialUnit?: string;
  initialQty?: number;
  initialMeal: Meal;
  /** The day's totals without this food. */
  before: Nutrients;
  targets: Nutrients;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (choice: PortionChoice) => void;
  onDelete?: () => void;
  deleting?: boolean;
  favorite?: boolean;
  onToggleFavorite?: () => void;
};

export function FoodDetail(p: FoodDetailProps) {
  const { colors } = useTheme();
  const units = useMemo(() => unitsFor(p.food, p.food.servings), [p.food]);
  const startUnit = units.find((u) => u.label === p.initialUnit) ?? units[0];
  const [unitKey, setUnitKey] = useState(startUnit.key);
  const unit = units.find((u) => u.key === unitKey) ?? units[0];
  const [qty, setQty] = useState(p.initialQty && p.initialQty > 0 ? p.initialQty : startUnit.defaultQty);
  const [meal, setMeal] = useState<Meal>(p.initialMeal);
  const [typing, setTyping] = useState<string | null>(null);

  const grams = qty * unit.grams;
  const n = nutrientsFor(p.food, grams);
  const pk = n.protein_g * 4;
  const ck = n.carbs_g * 4;
  const fk = n.fat_g * 9;
  const total = pk + ck + fk || 1;
  const fiberKnown = p.food.fiber_100g !== null;

  function changeUnit(key: string) {
    const next = units.find((u) => u.key === key);
    if (!next) return;
    setUnitKey(key);
    // Keep roughly the same amount of food when switching units.
    const converted = Math.round((grams / next.grams) / next.step) * next.step;
    setQty(clampQty(converted || next.defaultQty, next));
  }

  function commitTyping() {
    const v = typing === null ? null : parseNumber(typing);
    if (v !== null && v > 0) setQty(Math.min(unit.max, v));
    setTyping(null);
  }

  const macroLegend = [
    { label: 'Protein', g: n.protein_g, kcal: pk, color: colors.protein },
    { label: 'Carbs', g: n.carbs_g, kcal: ck, color: colors.carbs },
    { label: 'Fat', g: n.fat_g, kcal: fk, color: colors.fat },
  ];

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader
        title={p.mode === 'edit' ? 'Edit entry' : 'Food'}
        onClose={p.onClose}
        right={
          p.onToggleFavorite ? (
            <IconButton
              icon="star"
              label={p.favorite ? 'Remove from favorites' : 'Add to favorites'}
              accessibilityState={{ selected: Boolean(p.favorite) }}
              iconColor={p.favorite ? 'carbs' : 'textSecondary'}
              filled={p.favorite}
              onPress={p.onToggleFavorite}
            />
          ) : null
        }
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.titles}>
          <Text variant="title" accessibilityRole="header">
            {p.food.brand && p.food.source !== 'custom' ? `${p.food.name}, ${p.food.brand}` : p.food.name}
          </Text>
          <View style={styles.source}>
            <Icon name="check" size={13} color="good" strokeWidth={2.6} />
            <Text variant="caption" color="textSecondary">
              {SOURCE_LABEL[p.food.source]}
              {p.food.source === 'custom' && p.food.brand ? ` · ${p.food.brand}` : ''}
            </Text>
            {p.favorite ? <Icon name="star" size={13} color="carbs" filled /> : null}
          </View>
        </View>

        <View style={styles.kcalRow}>
          <Text variant="hero" tabular>
            {formatInt(n.kcal)}
          </Text>
          <Text variant="body" color="textSecondary">
            kcal
          </Text>
        </View>

        <View>
          <View style={styles.split}>
            {macroLegend.map((m) => (
              <View key={m.label} style={{ flex: Math.max(m.kcal, 0.0001), backgroundColor: m.color }} />
            ))}
          </View>
          <View style={styles.legend}>
            {macroLegend.map((m) => (
              <View key={m.label} style={styles.legendItem}>
                <View style={styles.legendHead}>
                  <View style={[styles.dot, { backgroundColor: m.color }]} />
                  <Text variant="caption" color="textSecondary">
                    {m.label}
                  </Text>
                </View>
                <Text variant="bodyStrong" tabular>
                  {m.g > 0 && m.g < 10 ? m.g.toFixed(1) : Math.round(m.g)} g
                </Text>
                <Text variant="caption" color="textTertiary" tabular>
                  {Math.round((m.kcal / total) * 100)}% of kcal
                </Text>
              </View>
            ))}
            <View style={styles.legendItem}>
              <View style={styles.legendHead}>
                <View style={[styles.dot, { backgroundColor: colors.fiber }]} />
                <Text variant="caption" color="textSecondary">
                  Fibre
                </Text>
              </View>
              <Text variant="bodyStrong" tabular>
                {fiberKnown ? `${n.fiber_g > 0 && n.fiber_g < 10 ? n.fiber_g.toFixed(1) : Math.round(n.fiber_g)} g` : '–'}
              </Text>
              <Text variant="caption" color="textTertiary" tabular>
                {fiberKnown ? `${Math.round((n.fiber_g / (p.targets.fiber_g || 1)) * 100)}% of day` : 'Not listed'}
              </Text>
            </View>
          </View>
        </View>

        <Card style={styles.portion}>
          {units.length > 1 ? (
            <SegmentedControl
              label="Unit"
              options={units.map((u) => ({ value: u.key, label: u.label }))}
              value={unit.key}
              onChange={changeUnit}
            />
          ) : null}
          <View style={styles.qtyRow}>
            <IconButton icon="minus" label={`Less ${unit.label}`} onPress={() => setQty((q) => clampQty(Math.round((q - unit.step) * 100) / 100, unit))} />
            {typing !== null ? (
              <TextInput
                autoFocus
                value={typing}
                onChangeText={setTyping}
                onBlur={commitTyping}
                onSubmitEditing={commitTyping}
                keyboardType="decimal-pad"
                selectTextOnFocus
                accessibilityLabel="Amount"
                style={[styles.qtyInput, { color: colors.text, borderColor: colors.accent }]}
              />
            ) : (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${formatQty(qty)} ${unit.label}. Tap to type an amount.`}
                ripple={null}
                pressedScale={0.96}
                onPress={() => setTyping(formatQty(qty))}
                style={styles.qtyButton}>
                <Text variant="hero" tabular>
                  {formatQty(qty)}
                </Text>
                <Text variant="body" color="textSecondary">
                  {pluralize(unit.label, qty)}
                </Text>
              </PressableScale>
            )}
            <IconButton icon="plus" label={`More ${unit.label}`} onPress={() => setQty((q) => clampQty(Math.round((q + unit.step) * 100) / 100, unit))} />
          </View>
          <Text variant="label" align="center">
            {unit.label === 'g' ? 'Tap the number to type it' : `≈ ${Math.round(grams)} g · tap the number to type it`}
          </Text>
          <PortionRuler key={unit.key} unit={unit} value={qty} onChange={setQty} background={colors.surface1} />
        </Card>

        <View style={styles.group}>
          <Text variant="caption" color="textSecondary">
            Meal
          </Text>
          <SegmentedControl label="Meal" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />
        </View>

        <ImpactPreview before={p.before} adding={n} targets={p.targets} />
      </ScrollView>

      <EditorFooter
        label={p.mode === 'edit' ? 'Save changes' : `Add to ${MEAL_LABEL[meal]}`}
        trailing={`${formatInt(n.kcal)} kcal`}
        loading={p.saving}
        error={p.error}
        onPress={() => p.onSubmit({ meal, qty, unit, grams, nutrients: n })}
        onDelete={p.onDelete}
        deleting={p.deleting}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxl, gap: space.xl },
  titles: { gap: space.sm, marginTop: space.sm },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  split: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', marginTop: space.md },
  legendItem: { flex: 1, gap: 1 },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 2 },
  portion: { paddingVertical: space.lg, paddingHorizontal: space.md, gap: space.md },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs },
  qtyButton: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.md },
  qtyInput: {
    minWidth: 120,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 36,
    borderBottomWidth: 2,
    paddingVertical: 0,
  },
  group: { gap: space.sm },
});
