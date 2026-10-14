import { TabList, TabSlot, TabTrigger, Tabs, type TabsDescriptor, type TabsSlotRenderOptions } from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingTabBar, TabButton } from '@/components/navigation/FloatingTabBar';
import { ToastHost } from '@/components/ui/ToastHost';
import { useReminderPlanner } from '@/features/reminders/usePlanner';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  useReminderPlanner();
  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.root} detachInactiveScreens={false} renderFn={renderTab} />
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

/**
 * Each tab in a plain view, shown or hidden by focus: built the first time
 * you open it, then kept, so switching back is instant. Not native screens:
 * Android's native screen container ignores the display switch and detaches
 * hidden tabs, so every tab but the first came back with no size (a blank,
 * dark screen); and with native screens off, the web version drops the style
 * that hides a tab.
 */
function renderTab(descriptor: TabsDescriptor, { isFocused, loaded }: TabsSlotRenderOptions) {
  if (!loaded && !isFocused) return null;
  return (
    <View key={descriptor.route.key} style={[styles.root, !isFocused && styles.hidden]}>
      {descriptor.render()}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { display: 'none' },
});
