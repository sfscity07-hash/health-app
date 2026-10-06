import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { EditorFooter } from '@/components/food/EditorFooter';
import { ModalHeader } from '@/components/food/ModalHeader';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage } from '@/features/auth/errors';
import { useCreateFood } from '@/features/food/api';
import { buildCustomFood, type CustomFoodForm } from '@/features/food/forms';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';

type Params = { date?: string; meal?: string; name?: string };

/** Create a food from its nutrition label, then pick how much you had. */
export default function NewFoodScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<Params>();
  const createFood = useCreateFood();
  const showToast = useToast((s) => s.show);
  const [form, setForm] = useState<CustomFoodForm>({
    name: params.name ?? '',
    brand: '',
    servingLabel: '',
    servingGrams: '',
    kcal: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof CustomFoodForm) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setError(null);
  };

  const perServing = form.servingLabel.trim() !== '';
  const per = perServing ? `per ${form.servingLabel.trim().toLowerCase()}` : 'per 100 g';

  async function save() {
    const built = buildCustomFood(form);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    try {
      const food = await createFood.mutateAsync(built.food);
      showToast(`Saved ${food.name} to your foods`);
      router.replace({ pathname: '/food/[id]', params: { id: food.id, date: params.date ?? '', meal: params.meal ?? '' } });
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
        </View>

        <View style={styles.group}>
          <TextField label="Name" value={form.name} onChangeText={set('name')} placeholder="e.g. Protein bar" autoFocus={!params.name} maxLength={200} />
          <TextField label="Brand (optional)" value={form.brand} onChangeText={set('brand')} placeholder="e.g. Grenade" maxLength={120} />
        </View>

        <Card style={styles.card}>
          <Text variant="label">Serving</Text>
          <View style={styles.row}>
            <TextField
              label="Name it"
              flex
              value={form.servingLabel}
              onChangeText={set('servingLabel')}
              placeholder="bar, slice, cup"
              autoCapitalize="none"
              maxLength={40}
            />
            <TextField
              label="It weighs"
              flex
              suffix="g"
              value={form.servingGrams}
              onChangeText={set('servingGrams')}
              keyboardType="decimal-pad"
              placeholder={perServing ? '60' : '100'}
              editable={perServing}
            />
          </View>
          <Text variant="caption" color="textTertiary">
            {perServing ? 'Values below are for one serving.' : 'No serving? Leave it empty and enter the values per 100 g.'}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text variant="label">Nutrition {per}</Text>
          <TextField label="Calories" suffix="kcal" value={form.kcal} onChangeText={set('kcal')} keyboardType="decimal-pad" placeholder="0" />
          <View style={styles.row}>
            <TextField label="Protein" suffix="g" flex value={form.protein} onChangeText={set('protein')} keyboardType="decimal-pad" placeholder="0" />
            <TextField label="Carbs" suffix="g" flex value={form.carbs} onChangeText={set('carbs')} keyboardType="decimal-pad" placeholder="0" />
          </View>
          <View style={styles.row}>
            <TextField label="Fat" suffix="g" flex value={form.fat} onChangeText={set('fat')} keyboardType="decimal-pad" placeholder="0" />
            <TextField label="Fibre" suffix="g" flex value={form.fiber} onChangeText={set('fiber')} keyboardType="decimal-pad" placeholder="0" />
          </View>
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
  group: { gap: space.md },
  card: { padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', gap: space.sm },
});
