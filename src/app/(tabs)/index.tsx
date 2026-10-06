import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { formatDayLabel, greetingFor } from '@/lib/format';

export default function DashboardScreen() {
  const now = new Date();
  return (
    <Screen eyebrow={formatDayLabel(now)} title={greetingFor(now)}>
      <EmptyState
        icon="target"
        title="Your day starts here"
        body="The calorie gauge, week rings, macros and today's food timeline arrive in Phase 3. Tap + to see where logging will open."
      />
    </Screen>
  );
}
