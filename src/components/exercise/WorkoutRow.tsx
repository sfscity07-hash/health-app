import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { formatInt } from '@/lib/format';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

type WorkoutRowProps = {
  name: string;
  detail: string;
  kcal: number;
  /** Small text under the calories, e.g. "per 30 min". */
  kcalNote?: string;
  onPress: () => void;
  first?: boolean;
  /** What tapping does, read out after the row, e.g. "Tap to edit." */
  hint: string;
};

/** A workout you logged, or an activity to log: name, how long, calories. */
export function WorkoutRow({ name, detail, kcal, kcalNote, onPress, first, hint }: WorkoutRowProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${detail}, ${formatInt(kcal)} calories${kcalNote ? ` ${kcalNote}` : ''}. ${hint}`}
      pressedScale={0.985}
      onPress={onPress}
      style={[styles.row, !first && { borderTopColor: colors.hairline, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
      <View style={styles.text}>
        <Text variant="body" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" color="textTertiary" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <View style={styles.kcal}>
        <Text variant="smallStrong" color="textSecondary" tabular>
          {formatInt(kcal)}
        </Text>
        {kcalNote ? (
          <Text variant="caption" color="textTertiary">
            {kcalNote}
          </Text>
        ) : null}
      </View>
      <Icon name="chevronRight" size={15} color="textTertiary" />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  text: { flex: 1, minWidth: 0, gap: 2 },
  kcal: { alignItems: 'flex-end', gap: 1 },
});
