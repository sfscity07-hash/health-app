import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

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
  favorite?: boolean;
  /** Opens the food so you can change the amount. */
  onPress: () => void;
  /** Logs it straight away with the amount shown. */
  onAdd: () => void;
  first?: boolean;
};

/** One food in the logger: tap the row to adjust, tap + to log it as shown. */
export function FoodRow({ name, detail, kcal, favorite, onPress, onAdd, first }: FoodRowProps) {
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
        accessibilityLabel={`${name}, ${detail}, ${formatInt(kcal)} calories. Opens the food.`}
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
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {detail}
          </Text>
        </View>
        <Text variant="smallStrong" color="textSecondary" tabular>
          {formatInt(kcal)}
        </Text>
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
  add: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
