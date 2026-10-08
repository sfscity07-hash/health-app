import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { workoutDetail, workoutSummary, workoutTotals, type Workout } from '@/features/exercise/logic';
import { formatInt } from '@/lib/format';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

type ExerciseCardProps = {
  workouts: Workout[];
  /** Whether what you burn is added to the day's budget. */
  addback: boolean;
  onAdd: () => void;
  onPressWorkout: (w: Workout) => void;
};

/** The day's workouts on the Food log, under the meals. */
export function ExerciseCard({ workouts, addback, onAdd, onPressWorkout }: ExerciseCardProps) {
  const { colors } = useTheme();
  const { kcal } = workoutTotals(workouts);
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text variant="heading">Exercise</Text>
          <Text variant="caption" color="textSecondary" tabular>
            {workouts.length === 0
              ? 'Nothing yet'
              : `${formatInt(kcal)} kcal burned · ${workoutSummary(workouts)}${addback ? ' · in your budget' : ''}`}
          </Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Log exercise"
          haptic="tap"
          pressedScale={0.9}
          hitSlop={6}
          onPress={onAdd}
          style={[styles.add, { backgroundColor: colors.accentSoft }]}>
          <Icon name="plus" size={17} color="accent" strokeWidth={2.4} />
        </PressableScale>
      </View>
      {workouts.map((w) => (
        <PressableScale
          key={w.id}
          accessibilityRole="button"
          accessibilityLabel={`${w.name}, ${workoutDetail(w)}, ${formatInt(w.kcal_burned)} calories burned. Tap to edit.`}
          pressedScale={0.985}
          onPress={() => onPressWorkout(w)}
          style={[styles.entry, { borderTopColor: colors.hairline }]}>
          <View style={styles.entryText}>
            <Text variant="body" numberOfLines={1}>
              {w.name}
            </Text>
            <Text variant="caption" color="textTertiary" numberOfLines={1}>
              {workoutDetail(w)}
            </Text>
          </View>
          <Text variant="smallStrong" tabular>
            −{formatInt(w.kcal_burned)}
          </Text>
        </PressableScale>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.sm },
  headText: { flex: 1, gap: 1 },
  add: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  entryText: { flex: 1, minWidth: 0, gap: 2 },
});
