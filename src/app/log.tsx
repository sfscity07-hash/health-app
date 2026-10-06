import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { MEAL_LABEL, mealForTime } from '@/lib/meals';
import { useTheme } from '@/theme/theme';
import { gutter, radius, space } from '@/theme/tokens';

const QUICK_ACTIONS: { icon: IconName; label: string }[] = [
  { icon: 'scan', label: 'Scan' },
  { icon: 'bolt', label: 'Quick add' },
  { icon: 'bookmark', label: 'Saved' },
];

/** The food logger sheet. Search, scan and quick add are built in Phases 4–6. */
export default function LogSheet() {
  const { colors } = useTheme();
  const meal = MEAL_LABEL[mealForTime(new Date())];

  return (
    <View style={[styles.root, { backgroundColor: colors.surface1 }]}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          <Text variant="title" color="textTertiary">
            Add to{' '}
          </Text>
          {meal}
        </Text>
        <IconButton icon="close" label="Close" size={36} onPress={() => router.back()} />
      </View>

      <View style={[styles.search, { backgroundColor: colors.surface2, borderColor: colors.hairline }]}>
        <Icon name="search" size={17} color="textTertiary" />
        <Text variant="body" color="textTertiary" style={styles.searchText}>
          Search foods
        </Text>
        <View style={[styles.scan, { backgroundColor: colors.surface3 }]}>
          <Icon name="scan" size={17} />
        </View>
      </View>

      <View style={styles.actions}>
        {QUICK_ACTIONS.map((a) => (
          <View key={a.label} style={[styles.action, { backgroundColor: colors.surface2 }]}>
            <Icon name={a.icon} size={20} color="accent" />
            <Text variant="caption" color="text">
              {a.label}
            </Text>
          </View>
        ))}
      </View>

      <EmptyState
        icon="search"
        title="Logging opens here"
        body="Food search, barcode scanning, quick add and saved meals arrive in Phases 4 to 7."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: gutter, paddingTop: space.xxl, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  search: {
    height: 46,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
  },
  searchText: { flex: 1 },
  scan: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, alignItems: 'center', gap: space.sm, paddingVertical: 14, borderRadius: radius.lg },
});
