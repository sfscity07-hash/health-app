import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme';

/** Segmented progress for multi-step flows: done and current segments are filled. */
export function StepProgress({ total, current }: { total: number; current: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current + 1} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current + 1 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.seg, { backgroundColor: i <= current ? colors.accent : colors.surface3 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
});
