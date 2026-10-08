import { router, useLocalSearchParams } from 'expo-router';

import { EditorStatus } from '@/components/food/EditorStatus';
import { WorkoutEditor } from '@/components/exercise/WorkoutEditor';
import { useWeighIns } from '@/features/dashboard/api';
import { useActivities, useBodyWeightKg, useWorkouts } from '@/features/exercise/api';
import { useProfile } from '@/features/profile/api';
import { toISODate } from '@/lib/dates';

/** Change or delete a workout you logged. */
export default function WorkoutScreen() {
  const params = useLocalSearchParams<{ id: string; date: string }>();
  const today = toISODate(new Date());
  const date = params.date || today;
  const { data: profile } = useProfile();
  const workouts = useWorkouts(date);
  const activities = useActivities();
  const weighIns = useWeighIns();
  const kg = useBodyWeightKg();
  const close = () => router.back();

  if (workouts.isPending || activities.isPending || weighIns.isPending) return <EditorStatus title="Workout" onClose={close} />;
  const workout = workouts.data?.find((w) => w.id === params.id);
  if (!workout) {
    return <EditorStatus title="Workout" onClose={close} problem={{ title: 'This workout was deleted', body: 'Go back to see the day’s exercise.' }} />;
  }
  const activity = workout.exercise_id === null ? null : (activities.data?.find((a) => a.id === workout.exercise_id) ?? null);
  return (
    <WorkoutEditor
      date={date}
      today={today}
      activity={activity}
      existing={workout}
      kg={kg}
      units={profile?.units ?? 'metric'}
      addback={profile?.exercise_addback ?? false}
    />
  );
}
