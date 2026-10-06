import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';

/** Room left under scrolling content so the floating tab bar never covers it. */
export const TAB_BAR_CLEARANCE = 120;

type ScreenProps = PropsWithChildren<{
  /** Small mono label above the title, e.g. "Tue · Oct 6". */
  eyebrow?: string;
  title?: string;
  /** Element on the right of the title row, e.g. the streak counter. */
  accessory?: ReactNode;
}>;

export function Screen({ eyebrow, title, accessory, children }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}>
        {title ? (
          <View style={styles.header}>
            <View style={styles.headerText}>
              {eyebrow ? <Text variant="label">{eyebrow}</Text> : null}
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
});
