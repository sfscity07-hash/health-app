import { router, useLocalSearchParams } from 'expo-router';

import { EditorStatus } from '@/components/food/EditorStatus';
import { WorkoutEditor } from '@/components/exercise/WorkoutEditor';
import { useActivities, useBodyWeightKg } from '@/features/exercise/api';
import { useProfile } from '@/features/profile/api';
import { toISODate } from '@/lib/dates';

/** Log a workout: an activity from the list (`activity` id), or calories you type (no `activity`). */
export default function NewWorkoutScreen() {
  const params = useLocalSearchParams<{ date?: string; activity?: string; minutes?: string }>();
  const today = toISODate(new Date());
  const date = params.date || today;
  const { data: profile } = useProfile();
  const activities = useActivities();
  const kg = useBodyWeightKg();
  const activityId = params.activity ? Number(params.activity) : null;
  const activity = activityId === null ? null : (activities.data?.find((a) => a.id === activityId) ?? null);

  if (activityId !== null && activities.isPending) return <EditorStatus title="Exercise" onClose={() => router.back()} />;
  return (
    <WorkoutEditor
      date={date}
      today={today}
      activity={activity}
      startMinutes={params.minutes ? Number(params.minutes) : undefined}
      kg={kg}
      units={profile?.units ?? 'metric'}
      addback={profile?.exercise_addback ?? false}
    />
  );
}
