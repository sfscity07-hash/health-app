import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useProfile } from '@/features/profile/api';
import { formatDayLabel, formatInt, greetingFor } from '@/lib/format';

export default function DashboardScreen() {
  const now = new Date();
  const { data: profile } = useProfile();
  const budget = profile?.calorie_target;
  return (
    <Screen eyebrow={formatDayLabel(now)} title={greetingFor(now)}>
      <EmptyState
        icon="target"
        title={budget ? `Your budget: ${formatInt(budget)} kcal a day` : 'Your day starts here'}
        body="The calorie gauge, week rings, macros and today's food timeline arrive in Phase 3. Tap + to see where logging will open."
      />
    </Screen>
  );
}
