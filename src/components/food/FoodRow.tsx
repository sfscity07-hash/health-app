import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { MacroMix } from '@/components/food/MacroMix';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { formatInt } from '@/lib/format';
import { success } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

type FoodRowProps = {
  name: string;
  detail: string;
  kcal: number;
  /** Grams of protein, carbs and fat in the amount shown, for the little split bar. */
  macros?: { p: number; c: number; f: number };
  /** Where it's from, e.g. "USDA". */
  tag?: string;
  favorite?: boolean;
  /** Opens the food so you can change the amount. */
  onPress: () => void;
  /** Logs it straight away with the amount shown. */
  onAdd: () => void;
  first?: boolean;
  /** Read out after the row; it's a food unless you say otherwise. */
  pressHint?: string;
};

/** One food in the logger: tap the row to adjust, tap + to log it as shown. */
export function FoodRow({ name, detail, kcal, macros, tag, favorite, onPress, onAdd, first, pressHint = 'Opens the food.' }: FoodRowProps) {
  const { colors } = useTheme();
  const [added, setAdded] = useState(0);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(0), 1400);
    return () => clearTimeout(t);
  }, [added]);

  return (
    <View style={[styles.row, !first && { borderTopColor: colors.hairline, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${detail}, ${formatInt(kcal)} calories. ${pressHint}`}
        pressedScale={0.985}
        onPress={onPress}
        style={styles.main}>
        <View style={styles.text}>
          <View style={styles.titleRow}>
            {favorite ? <Icon name="star" size={12} color="carbs" filled /> : null}
            <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
              {name}
            </Text>
          </View>
          <View style={styles.detailRow}>
            {tag ? (
              <View style={[styles.tag, { borderColor: colors.hairlineStrong }]}>
                <Text variant="label" style={styles.tagText}>
                  {tag}
                </Text>
              </View>
            ) : null}
            <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.detail}>
              {detail}
            </Text>
          </View>
        </View>
        <View style={styles.kcal}>
          <Text variant="smallStrong" color="textSecondary" tabular>
            {formatInt(kcal)}
          </Text>
          {macros ? <MacroMix p={macros.p} c={macros.c} f={macros.f} width={24} /> : null}
        </View>
      </PressableScale>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Add ${name}`}
        hitSlop={8}
        pressedScale={0.88}
        ripple={null}
        onPress={() => {
          success();
          setAdded((n) => n + 1);
          onAdd();
        }}
        style={[styles.add, { backgroundColor: added ? colors.good : colors.accentSoft }]}>
        {added ? (
          <Animated.View key={added} entering={ZoomIn.springify().damping(14)}>
            <Icon name="check" size={17} color="bg" strokeWidth={2.6} />
          </Animated.View>
        ) : (
          <Icon name="plus" size={17} color="accent" strokeWidth={2.4} />
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderRadius: radius.md },
  text: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { flexShrink: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detail: { flexShrink: 1 },
  tag: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  tagText: { fontSize: 8.5, lineHeight: 11, letterSpacing: 0.5 },
  kcal: { alignItems: 'flex-end', gap: 5 },
  add: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
