import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingTabBar, TabButton } from '@/components/navigation/FloatingTabBar';
import { ToastHost } from '@/components/ui/ToastHost';
import { useReminderPlanner } from '@/features/reminders/usePlanner';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  useReminderPlanner();
  return (
    // Each tab is built the first time you open it and then stays built, so
    // switching back is instant. (Building all four up front and freezing the
    // hidden ones left them blank on Android: a tab frozen before it was ever
    // shown never drew its content.)
    <Tabs style={styles.root}>
      <TabSlot style={styles.root} />
      <TabList asChild>
        <FloatingTabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="home" label="Dashboard" />
          </TabTrigger>
          <TabTrigger name="food-log" href="/food-log" asChild>
            <TabButton icon="book" label="Food log" />
          </TabTrigger>
          <TabTrigger name="progress" href="/progress" asChild>
            <TabButton icon="chart" label="Progress" />
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton icon="user" label="Profile" />
          </TabTrigger>
        </FloatingTabBar>
      </TabList>
      <ToastHost bottom={insets.bottom + 96} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
