import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useOnline } from '@/lib/online';
import { useTheme } from '@/theme/theme';
import { gutter, radius, space } from '@/theme/tokens';

/** Room left under scrolling content so the floating tab bar never covers it. */
export const TAB_BAR_CLEARANCE = 120;

type ScreenProps = PropsWithChildren<{
  /** Small mono label above the title, e.g. "Tue · Oct 6". */
  eyebrow?: string;
  title?: string;
  /** Element on the right of the title row, e.g. the streak counter. */
  accessory?: ReactNode;
  /** Pull-to-refresh: called when you drag the screen down. */
  onRefresh?: () => Promise<unknown>;
}>;

export function Screen({ eyebrow, title, accessory, onRefresh, children }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const online = useOnline();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.accent}
              colors={[colors.accent]}
              progressBackgroundColor={colors.surface2}
              onRefresh={() => {
                // Offline, a refresh would wait for the connection; the Offline tag says why nothing changed.
                if (!online) return;
                setRefreshing(true);
                onRefresh().finally(() => setRefreshing(false));
              }}
            />
          ) : undefined
        }
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}>
        {title ? (
          <View style={styles.header}>
            <View style={styles.headerText}>
              {eyebrow || !online ? (
                <View style={styles.eyebrow}>
                  {eyebrow ? <Text variant="label">{eyebrow}</Text> : null}
                  {online ? null : (
                    <View
                      style={[styles.offline, { backgroundColor: colors.surface2 }]}
                      accessible
                      accessibilityLabel="Offline. Showing what's saved on your phone; it refreshes when you're back online."
                      accessibilityLiveRegion="polite">
                      <Icon name="offline" size={12} color="textSecondary" strokeWidth={2.2} />
                      <Text variant="caption" color="textSecondary">
                        Offline · saved data
                      </Text>
                    </View>
                  )}
                </View>
              ) : null}
              <Text variant="title" accessibilityRole="header">
                {title}
              </Text>
            </View>
            {accessory}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gutter, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerText: { gap: 3, flexShrink: 1 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill },
});
