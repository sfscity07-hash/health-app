import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WorkoutRow } from '@/components/exercise/WorkoutRow';
import { relativeDay } from '@/components/foodlog/DayNav';
import { FoodRow } from '@/components/food/FoodRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { Text } from '@/components/ui/Text';
import { ToastHost } from '@/components/ui/ToastHost';
import { loadErrorMessage } from '@/features/auth/errors';
import { estimateWorkout } from '@/features/exercise/energy';
import { useActivities, useBody, useLogWorkout, useRecentWorkouts, useWorkouts } from '@/features/exercise/api';
import {
  activityMatches,
  ADDBACK,
  DEFAULT_MINUTES,
  groupActivities,
  intensity,
  workoutDetail,
  workoutTotals,
  type Workout,
} from '@/features/exercise/logic';
import { useProfile, useUpdateProfile } from '@/features/profile/api';
import { toISODate } from '@/lib/dates';
import { formatInt } from '@/lib/format';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { fonts, gutter, space } from '@/theme/tokens';

/** The day's exercise, and every way to add some: recent workouts, the activity list, or calories from your watch. */
export default function ExerciseSheet() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();
  const today = toISODate(new Date());
  const date = params.date || today;
  const [query, setQuery] = useState('');
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const workouts = useWorkouts(date);
  const recent = useRecentWorkouts();
  const activities = useActivities();
  const logWorkout = useLogWorkout();
  const showToast = useToast((s) => s.show);
  const body = useBody();

  const searching = query.trim().length > 0;
  const day = relativeDay(date, today);
  const logged = workouts.data ?? [];
  const totals = workoutTotals(logged);
  const addback = profile?.exercise_addback ?? false;
  const recents = (recent.data ?? []).filter((w) => !searching || activityMatches(query, { name: w.name, category: '' }));
  const groups = groupActivities(activities.data ?? [], query);

  const openActivity = (id: number, recentId?: string) =>
    router.push({ pathname: '/exercise/new', params: { date, activity: String(id), ...(recentId ? { from: recentId } : {}) } });
  const openOwn = () => router.push({ pathname: '/exercise/new', params: { date } });

  function repeat(w: Workout) {
    const { exercise_id, name, duration_min, kcal_burned, speed_kmh, incline_pct, effort, avg_hr } = w;
    logWorkout.mutate({ log_date: date, exercise_id, name, duration_min, kcal_burned, speed_kmh, incline_pct, effort, avg_hr });
    showToast(`Logged ${w.name} · ${formatInt(w.kcal_burned)} kcal`);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.surface1 }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="label">{day}</Text>
          <Text variant="title" accessibilityRole="header">
            Exercise
          </Text>
          <Text variant="caption" color="textSecondary" tabular>
            {totals.count === 0 ? 'Nothing logged yet' : `${formatInt(totals.kcal)} kcal burned`}
            {' · '}
            {addback ? 'added to your budget' : 'not added to your budget'}
          </Text>
        </View>
        <IconButton icon="close" label="Close" size={36} onPress={() => router.back()} />
      </View>

      <View style={[styles.search, { backgroundColor: colors.surface2, borderColor: colors.hairline }]}>
        <Icon name="search" size={17} color="textTertiary" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search activities"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search activities"
          style={[styles.searchInput, { color: colors.text }, Platform.OS === 'web' && styles.noWebOutline]}
        />
        {searching ? <IconButton icon="close" label="Clear search" size={30} onPress={() => setQuery('')} /> : null}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 96 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {!searching && logged.length > 0 ? (
          <View>
            <View style={styles.sectionHead}>
              <Text variant="label">{day === 'Today' ? 'Logged today' : `Logged ${day}`}</Text>
              <Text variant="label">kcal</Text>
            </View>
            {logged.map((w, i) => (
              <WorkoutRow
                key={w.id}
                first={i === 0}
                name={w.name}
                detail={workoutDetail(w)}
                kcal={w.kcal_burned}
                hint="Tap to change or delete."
                onPress={() => {
                  if (!w.id.startsWith('temp-')) router.push({ pathname: '/exercise/[id]', params: { id: w.id, date } });
                }}
              />
            ))}
          </View>
        ) : null}

        {recents.length > 0 ? (
          <View>
            <View style={styles.sectionHead}>
              <Text variant="label">Recent</Text>
              <Text variant="label">kcal</Text>
            </View>
            {recents.map((w, i) => (
              <FoodRow
                key={w.id}
                first={i === 0}
                name={w.name}
                detail={workoutDetail(w)}
                kcal={w.kcal_burned}
                pressHint="Opens the workout."
                onPress={() => (w.exercise_id !== null && w.duration_min ? openActivity(w.exercise_id, w.id) : openOwn())}
                onAdd={() => repeat(w)}
              />
            ))}
          </View>
        ) : null}

        {activities.isPending ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading activities" /> : null}
        {activities.isError ? (
          <Text variant="small" color="warn">
            {loadErrorMessage(activities.error, 'Couldn’t load the activity list. Close this and try again.')}
          </Text>
        ) : null}

        {groups.map((g) => (
          <View key={g.category}>
            <View style={styles.sectionHead}>
              <Text variant="label">{g.category}</Text>
              <Text variant="label">kcal / {DEFAULT_MINUTES} min</Text>
            </View>
            {g.items.map((a, i) => (
              <WorkoutRow
                key={a.id}
                first={i === 0}
                name={a.name}
                detail={intensity(a.met)}
                kcal={estimateWorkout(a, DEFAULT_MINUTES, body).kcal}
                hint="Tap to pick how long."
                onPress={() => openActivity(a.id)}
              />
            ))}
          </View>
        ))}

        {searching && groups.length === 0 && recents.length === 0 && !activities.isPending ? (
          <Card style={styles.note}>
            <Text variant="bodyStrong">No “{query.trim()}” on the list</Text>
            <Text variant="small" color="textSecondary">
              Log it with the calories from your watch or machine.
            </Text>
          </Card>
        ) : null}

        <Button label="Type calories from my watch" icon="plus" variant="secondary" onPress={openOwn} />

        {!searching ? (
          <Card style={styles.note}>
            <SwitchRow
              label={ADDBACK.label}
              description={addback ? ADDBACK.on : ADDBACK.off}
              value={addback}
              onChange={(v) => updateProfile.mutate({ exercise_addback: v })}
            />
          </Card>
        ) : null}

        {workouts.isError ? (
          <Text variant="small" color="warn">
            {loadErrorMessage(workouts.error)}
          </Text>
        ) : null}
      </ScrollView>

      <ToastHost bottom={insets.bottom + 24} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: space.xxl, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: gutter, gap: space.md },
  headerText: { flex: 1, gap: 3 },
  search: {
    height: 46,
    marginHorizontal: gutter,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
  },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15 },
  noWebOutline: { outlineWidth: 0 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: gutter, gap: space.xl },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 15 + space.md, marginBottom: space.xs },
  note: { padding: space.lg, gap: space.sm },
});
