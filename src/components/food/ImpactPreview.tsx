import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { formatInt } from '@/lib/format';
import type { Nutrients } from '@/lib/portion';
import { useTheme } from '@/theme/theme';
import { space, type ColorName } from '@/theme/tokens';

const ROWS: { key: keyof Nutrients; label: string; color: ColorName; unit: string }[] = [
  { key: 'kcal', label: 'Calories', color: 'accent', unit: '' },
  { key: 'protein_g', label: 'Protein', color: 'protein', unit: ' g' },
  { key: 'carbs_g', label: 'Carbs', color: 'carbs', unit: ' g' },
  { key: 'fat_g', label: 'Fat', color: 'fat', unit: ' g' },
  { key: 'fiber_g', label: 'Fibre', color: 'fiber', unit: ' g' },
];

/** "Your day after this": what you've had already, plus (lighter) what this food adds. */
export function ImpactPreview({ before, adding, targets }: { before: Nutrients; adding: Nutrients; targets: Nutrients }) {
  const { colors } = useTheme();
  const after = before.kcal + adding.kcal;
  const left = targets.kcal - after;
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text variant="label">Your day after this</Text>
        <Text variant="smallStrong" color={left < 0 ? 'warn' : 'text'} tabular>
          {left < 0 ? `${formatInt(-left)} kcal over` : `${formatInt(left)} kcal left`}
        </Text>
      </View>
      {ROWS.map((r) => {
        const target = targets[r.key] || 1;
        const base = Math.min(1, before[r.key] / target);
        const add = Math.max(0, Math.min(1, (before[r.key] + adding[r.key]) / target) - base);
        return (
          <View key={r.key} style={styles.row}>
            <View style={styles.rowHead}>
              <Text variant="caption" color="textSecondary">
                {r.label}
              </Text>
              <Text variant="caption" color="textSecondary" tabular>
                {formatInt(before[r.key])} →{' '}
                <Text variant="caption" color="text" style={styles.bold}>
                  {formatInt(before[r.key] + adding[r.key])}
                </Text>{' '}
                / {formatInt(targets[r.key])}
                {r.unit}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.surface3 }]}>
              <View style={{ width: `${base * 100}%`, backgroundColor: colors[r.color] }} />
              <View style={{ width: `${add * 100}%`, backgroundColor: colors[r.color], opacity: 0.4 }} />
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { gap: 6 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between' },
  bold: { fontWeight: '600' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' },
});
