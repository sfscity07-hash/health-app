import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';

export default function FoodLogScreen() {
  return (
    <Screen eyebrow="Today" title="Food log">
      <EmptyState
        icon="book"
        title="Nothing logged yet"
        body="Your full day by meal, with copy and multi-select, arrives with food logging in Phase 4."
      />
    </Screen>
  );
}
