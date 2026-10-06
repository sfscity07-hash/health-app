import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { DayNav } from '@/components/foodlog/DayNav';
import { MealCard } from '@/components/foodlog/MealCard';
import { AnimatedBar } from '@/components/ui/AnimatedBar';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useFoodLogs, useRefreshDashboard, type FoodLogEntry } from '@/features/dashboard/api';
import { useDayBudget } from '@/features/food/useDayBudget';
import { fromISODate, toISODate } from '@/lib/dates';
import { formatDayLabel, formatInt } from '@/lib/format';
import { MEALS } from '@/lib/meals';
import { useDay, useViewedDate } from '@/store/day';
import { useTheme } from '@/theme/theme';
import { space, type ColorName } from '@/theme/tokens';

const MACROS: { key: 'protein_g' | 'carbs_g' | 'fat_g'; label: string; color: ColorName }[] = [
  { key: 'protein_g', label: 'Protein', color: 'protein' },
  { key: 'carbs_g', label: 'Carbs', color: 'carbs' },
  { key: 'fat_g', label: 'Fat', color: 'fat' },
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
              <Text variant="caption" color="textSecondary" tabular>
                <Text variant="caption" color={m.color}>
                  {m.label}
                </Text>{' '}
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
          Couldn’t load this day. Pull down to try again.
        </Text>
      ) : (
        MEALS.map((meal) => (
          <MealCard
            key={meal}
            meal={meal}
            entries={entries.filter((e) => e.meal === meal)}
            onAdd={() => router.push({ pathname: '/log', params: { date, meal } })}
            onPressEntry={openEntry}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  totals: { padding: space.lg, gap: space.md },
  kcalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  leftCol: { alignItems: 'flex-end' },
  macros: { flexDirection: 'row', gap: space.md },
  macro: { flex: 1, gap: 6 },
  loading: { marginTop: space.xl },
});
