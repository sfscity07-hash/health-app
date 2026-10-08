import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { DayNav, relativeDay } from '@/components/foodlog/DayNav';
import { MealCard } from '@/components/foodlog/MealCard';
import { ActionSheet, type SheetAction } from '@/components/ui/ActionSheet';
import { AnimatedBar } from '@/components/ui/AnimatedBar';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { loadErrorMessage } from '@/features/auth/errors';
import { useFoodLogs, useRefreshDashboard, type FoodLogEntry } from '@/features/dashboard/api';
import { useLogEntries } from '@/features/food/api';
import { useDayBudget } from '@/features/food/useDayBudget';
import { copyEntries } from '@/features/meals/logic';
import { fromISODate, toISODate } from '@/lib/dates';
import { formatDayLabel, formatInt } from '@/lib/format';
import { success } from '@/lib/haptics';
import { MEAL_LABEL, MEALS, type Meal } from '@/lib/meals';
import { useDay, useViewedDate } from '@/store/day';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { space, type ColorName } from '@/theme/tokens';

const MACROS: { key: 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g'; label: string; color: ColorName }[] = [
  { key: 'protein_g', label: 'Protein', color: 'protein' },
  { key: 'carbs_g', label: 'Carbs', color: 'carbs' },
  { key: 'fat_g', label: 'Fat', color: 'fat' },
  { key: 'fiber_g', label: 'Fibre', color: 'fiber' },
];

/** The whole day, meal by meal. Tap a food to change it; step back through earlier days. */
export default function FoodLogScreen() {
  const { colors } = useTheme();
  const today = toISODate(new Date());
  const date = useViewedDate();
  const setDate = useDay((s) => s.setDate);
  const logs = useFoodLogs(date);
  const { eaten, targets } = useDayBudget(date);
  const refresh = useRefreshDashboard();
  const entries = logs.data ?? [];
  const left = targets.kcal - eaten.kcal;

  const logEntries = useLogEntries();
  const showToast = useToast((s) => s.show);
  const [menuFor, setMenuFor] = useState<Meal | null>(null);
  const saved = entries.filter((e) => !e.id.startsWith('temp-'));
  const isToday = date === today;

  /** Same foods, same amounts, on today's date. */
  function copyToToday(meal?: Meal) {
    const items = meal ? saved.filter((e) => e.meal === meal) : saved;
    if (items.length === 0) return;
    logEntries.mutate(copyEntries(items, today));
    success();
    const kcal = items.reduce((s, e) => s + e.kcal, 0);
    showToast(`Copied ${meal ? MEAL_LABEL[meal].toLowerCase() : 'the day'} to today · ${formatInt(kcal)} kcal`);
  }

  const menuActions = (meal: Meal): SheetAction[] => [
    ...(isToday ? [] : [{ label: 'Copy to today', icon: 'copy' as const, hint: `Into today’s ${MEAL_LABEL[meal].toLowerCase()}`, onPress: () => copyToToday(meal) }]),
    {
      label: isToday ? 'Copy to another day' : 'Copy to another day…',
      icon: 'copy',
      hint: 'Tomorrow, or any day this week, into any meal',
      onPress: () => router.push({ pathname: '/copy', params: { from: date, meal } }),
    },
    {
      label: 'Save as a meal',
      icon: 'bookmark',
      hint: 'Log it all again in one tap from Saved',
      onPress: () => router.push({ pathname: '/meal/new', params: { date, meal } }),
    },
  ];

  const openEntry = (e: FoodLogEntry) => {
    // Entries just added are saved in the background; they open once the server has them.
    if (!e.id.startsWith('temp-')) router.push({ pathname: '/entry/[id]', params: { id: e.id } });
  };

  return (
    <Screen
      eyebrow={formatDayLabel(fromISODate(date))}
      title="Food log"
      accessory={<DayNav date={date} today={today} onChange={setDate} />}
      onRefresh={refresh}>
      <Card style={styles.totals}>
        <View style={styles.kcalRow}>
          <View>
            <Text variant="label">Eaten</Text>
            <Text variant="title" tabular>
              <AnimatedNumber value={eaten.kcal} variant="title" />
              <Text variant="small" color="textSecondary">
                {' '}
                / {formatInt(targets.kcal)} kcal
              </Text>
            </Text>
          </View>
          <View style={styles.leftCol}>
            <Text variant="label">{left >= 0 ? 'Left' : 'Over'}</Text>
            <Text variant="heading" color={left >= 0 ? 'text' : 'warn'} tabular>
              {formatInt(Math.abs(left))}
            </Text>
          </View>
        </View>
        <AnimatedBar fraction={targets.kcal ? eaten.kcal / targets.kcal : 0} color={left >= 0 ? colors.accent : colors.warn} height={6} />
        <View style={styles.macros}>
          {MACROS.map((m) => (
            <View key={m.key} style={styles.macro}>
              <Text variant="caption" color={m.color}>
                {m.label}
              </Text>
              <Text variant="caption" color="textSecondary" tabular>
                {Math.round(eaten[m.key])}/{Math.round(targets[m.key])} g
              </Text>
              <AnimatedBar fraction={targets[m.key] ? eaten[m.key] / targets[m.key] : 0} color={colors[m.color]} height={3} />
            </View>
          ))}
        </View>
      </Card>

      {logs.isPending ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" style={styles.loading} />
      ) : logs.isError ? (
        <Text variant="small" color="warn">
          {loadErrorMessage(logs.error)}
        </Text>
      ) : (
        MEALS.map((meal) => (
          <MealCard
            key={meal}
            meal={meal}
            entries={entries.filter((e) => e.meal === meal)}
            onAdd={() => router.push({ pathname: '/log', params: { date, meal } })}
            onPressEntry={openEntry}
            onMore={() => setMenuFor(meal)}
          />
        ))
      )}

      {saved.length > 0 ? (
        <View style={styles.dayActions}>
          {!isToday ? <Button label="Copy this day to today" icon="copy" variant="secondary" onPress={() => copyToToday()} /> : null}
          <Button
            label={isToday ? 'Copy today to another day' : 'Copy this day to another day'}
            variant="ghost"
            onPress={() => router.push({ pathname: '/copy', params: { from: date } })}
          />
        </View>
      ) : null}

      <ActionSheet
        visible={menuFor !== null}
        title={menuFor ? MEAL_LABEL[menuFor] : ''}
        subtitle={menuFor ? `${relativeDay(date, today)} · ${formatInt(saved.filter((e) => e.meal === menuFor).reduce((s, e) => s + e.kcal, 0))} kcal` : undefined}
        actions={menuFor ? menuActions(menuFor) : []}
        onClose={() => setMenuFor(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  totals: { padding: space.lg, gap: space.md },
  kcalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  leftCol: { alignItems: 'flex-end' },
  macros: { flexDirection: 'row', gap: space.md },
  macro: { flex: 1, gap: 3 },
  loading: { marginTop: space.xl },
  dayActions: { gap: space.xs },
});
