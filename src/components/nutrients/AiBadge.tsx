import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';

/** The small "AI" label on any number that includes an AI estimate. */
export function AiBadge() {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.accentSoft }]} accessible accessibilityLabel="AI estimate">
      <Text variant="caption" color="accent" style={styles.text}>
        AI
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 0, alignSelf: 'center' },
  // The font's own bold: Android ignores fontWeight on custom fonts.
  text: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 14, letterSpacing: 0.4 },
});
