import { router, useLocalSearchParams } from 'expo-router';

import { EditorStatus } from '@/components/food/EditorStatus';
import { WorkoutEditor } from '@/components/exercise/WorkoutEditor';
import { useActivities, useBody, useRecentWorkouts } from '@/features/exercise/api';
import { useProfile } from '@/features/profile/api';
import { toISODate } from '@/lib/dates';

/** Log a workout: an activity from the list (`activity` id), or calories you type (no `activity`). `from` is a recent workout to start from. */
export default function NewWorkoutScreen() {
  const params = useLocalSearchParams<{ date?: string; activity?: string; from?: string }>();
  const today = toISODate(new Date());
  const date = params.date || today;
  const { data: profile } = useProfile();
  const activities = useActivities();
  const body = useBody();
  // Opened from a recent workout: start from its minutes, speed, effort and heart rate.
  const recent = useRecentWorkouts();
  const start = params.from ? recent.data?.find((w) => w.id === params.from) : undefined;
  const activityId = params.activity ? Number(params.activity) : null;
  const activity = activityId === null ? null : (activities.data?.find((a) => a.id === activityId) ?? null);

  if (activityId !== null && activities.isPending) return <EditorStatus title="Exercise" onClose={() => router.back()} />;
  return (
    <WorkoutEditor
      date={date}
      today={today}
      activity={activity}
      start={start}
      body={body}
      units={profile?.units ?? 'metric'}
      addback={profile?.exercise_addback ?? false}
    />
  );
}
