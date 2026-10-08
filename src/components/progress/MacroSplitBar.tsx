import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { MacroSplit } from '@/features/progress/logic';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

/** Where your calories came from on average, as one split bar, with grams against your targets. */
export function MacroSplitBar({ split, targets }: { split: MacroSplit; targets: { protein_g: number; carbs_g: number; fat_g: number } }) {
  const { colors } = useTheme();
  const parts = [
    { key: 'protein', label: 'Protein', share: split.share.protein, g: split.protein_g, target: targets.protein_g, color: colors.protein },
    { key: 'carbs', label: 'Carbs', share: split.share.carbs, g: split.carbs_g, target: targets.carbs_g, color: colors.carbs },
    { key: 'fat', label: 'Fat', share: split.share.fat, g: split.fat_g, target: targets.fat_g, color: colors.fat },
  ];
  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={`Average split: ${parts.map((p) => `${p.label} ${Math.round(p.share * 100)}%, ${p.g} of ${p.target} grams`).join('; ')}.`}>
      <View style={styles.bar}>
        {parts.map((p) => (p.share > 0 ? <View key={p.key} style={{ flex: p.share, backgroundColor: p.color, borderRadius: 3 }} /> : null))}
      </View>
      <View style={styles.legend}>
        {parts.map((p) => (
          <View key={p.key} style={styles.item}>
            <View style={styles.itemHead}>
              <View style={[styles.key, { backgroundColor: p.color }]} />
              <Text variant="caption" color="textSecondary">
                {p.label}
              </Text>
            </View>
            <Text variant="bodyStrong" tabular>
              {Math.round(p.share * 100)}%
            </Text>
            <Text variant="caption" color="textTertiary" tabular>
              {p.g} / {p.target} g
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  bar: { flexDirection: 'row', height: 8, gap: 2, borderRadius: 4, overflow: 'hidden' },
  legend: { flexDirection: 'row' },
  item: { flex: 1, gap: 1 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  key: { width: 6, height: 6, borderRadius: 2 },
});
