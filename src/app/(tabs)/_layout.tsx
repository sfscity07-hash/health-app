import { TabList, TabSlot, TabTrigger, Tabs, type ExpoTabsScreenOptions } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingTabBar, TabButton } from '@/components/navigation/FloatingTabBar';
import { ToastHost } from '@/components/ui/ToastHost';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    // All four tabs are built up front (lazy: false) so switching never waits on
    // a first render; hidden tabs are frozen so they cost nothing while away.
    <Tabs style={styles.root} options={{ screenOptions: TAB_SCREEN_OPTIONS }}>
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

// The published type wrongly requires per-trigger fields (title, action) here.
const TAB_SCREEN_OPTIONS = { lazy: false, freezeOnBlur: true } as Partial<ExpoTabsScreenOptions> as ExpoTabsScreenOptions;

const styles = StyleSheet.create({
  root: { flex: 1 },
});
