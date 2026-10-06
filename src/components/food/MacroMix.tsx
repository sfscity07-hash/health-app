import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme';

/** A tiny bar showing where a food's calories come from: protein, carbs, fat. */
export function MacroMix({ p, c, f, width = 28 }: { p: number; c: number; f: number; width?: number }) {
  const { colors } = useTheme();
  const parts = [
    { v: p * 4, color: colors.protein },
    { v: c * 4, color: colors.carbs },
    { v: f * 9, color: colors.fat },
  ].filter((x) => x.v > 0.5);
  return (
    <View style={[styles.mix, { width }]}>
      {parts.map((x, i) => (
        <View key={i} style={{ flex: x.v, backgroundColor: x.color }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mix: { flexDirection: 'row', height: 3, borderRadius: 2, overflow: 'hidden', gap: 1 },
});
