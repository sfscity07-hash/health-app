import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { EditorFooter } from '@/components/food/EditorFooter';
import { ModalHeader } from '@/components/food/ModalHeader';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage } from '@/features/auth/errors';
import { useFoodLogs } from '@/features/dashboard/api';
import { useCreateSavedMeal } from '@/features/meals/api';
import { mealSummary, suggestedMealName, totalOf } from '@/features/meals/logic';
import { formatInt } from '@/lib/format';
import { success } from '@/lib/haptics';
import { isMeal, MEAL_LABEL } from '@/lib/meals';
import { describeLogged } from '@/lib/portion';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { gutter, radius, space } from '@/theme/tokens';

/** Save a meal you logged under a name, so next time it's one tap. */
export default function NewSavedMealScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ date: string; meal: string }>();
  const meal = isMeal(params.meal) ? params.meal : 'breakfast';
  const logs = useFoodLogs(params.date ?? '');
  const create = useCreateSavedMeal();
  const showToast = useToast((s) => s.show);
  const entries = (logs.data ?? []).filter((e) => e.meal === meal && !e.id.startsWith('temp-'));
  const [name, setName] = useState(suggestedMealName(meal));
  const [left, setLeft] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const chosen = entries.filter((e) => !left.includes(e.id));
  const totals = totalOf(chosen.map((e) => ({ nutrients: e })));

  async function save() {
    if (!name.trim()) return setError('Give the meal a name.');
    if (chosen.length === 0) return setError('Pick at least one food.');
    try {
      await create.mutateAsync({ name, entries: chosen });
      success();
      showToast(`Saved “${name.trim()}”`);
      router.back();
    } catch (e) {
      setError(authErrorMessage(e));
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader title="Save as a meal" onClose={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text variant="title" accessibilityRole="header">
            Save your {MEAL_LABEL[meal].toLowerCase()}
          </Text>
          <Text variant="small" color="textSecondary">
            Next time, add all of it in one tap from Saved in the logger.
          </Text>
        </View>
        <TextField
          label="Name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
          placeholder="e.g. Usual breakfast"
          maxLength={80}
          selectTextOnFocus
        />
        <Card style={styles.card}>
          <Text variant="label">{mealSummary(chosen.length, totals.kcal)}</Text>
          {entries.map((e, i) => {
            const on = !left.includes(e.id);
            return (
              <PressableScale
                key={e.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${e.name}, ${formatInt(e.kcal)} calories`}
                haptic="tick"
                pressedScale={0.985}
                onPress={() => setLeft((l) => (on ? [...l, e.id] : l.filter((id) => id !== e.id)))}
                style={[styles.row, i > 0 && { borderTopColor: colors.hairline, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
                <View style={[styles.check, on ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: colors.hairlineStrong }]}>
                  {on ? <Icon name="check" size={13} color="accentInk" strokeWidth={3} /> : null}
                </View>
                <View style={styles.rowText}>
                  <Text variant="body" numberOfLines={1} color={on ? 'text' : 'textTertiary'}>
                    {e.name}
                  </Text>
                  <Text variant="caption" color="textTertiary">
                    {e.food_id ? describeLogged(e.quantity, e.unit, null) : 'Quick add'}
                  </Text>
                </View>
                <Text variant="smallStrong" color={on ? 'textSecondary' : 'textTertiary'} tabular>
                  {formatInt(e.kcal)}
                </Text>
              </PressableScale>
            );
          })}
        </Card>
      </ScrollView>
      <EditorFooter label="Save meal" trailing={`${formatInt(totals.kcal)} kcal`} onPress={save} loading={create.isPending} error={error} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxl, gap: space.xl },
  intro: { gap: space.xs, marginTop: space.sm },
  card: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  check: { width: 22, height: 22, borderRadius: radius.sm - 3, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
});
