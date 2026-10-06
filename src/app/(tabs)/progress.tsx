import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';

export default function ProgressScreen() {
  return (
    <Screen eyebrow="Since you started" title="Progress">
      <EmptyState
        icon="chart"
        title="Your trend starts with one weigh-in"
        body="Trend weight, your projected goal date, milestones and the streak grid arrive in Phases 8 to 11."
      />
    </Screen>
  );
}
