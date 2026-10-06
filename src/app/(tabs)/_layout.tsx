import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { FloatingTabBar, TabButton } from '@/components/navigation/FloatingTabBar';

export default function TabLayout() {
  return (
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
