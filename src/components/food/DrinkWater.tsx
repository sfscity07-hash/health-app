import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { useProfile } from '@/features/profile/api';
import { useDrinkWaterSetting } from '@/features/water/api';
import { formatDrink } from '@/features/water/logic';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

/**
 * For a drink: whether its water counts toward the day's water, and how much
 * that is. Turn it off for milk cooked down into oats and the like; the app
 * remembers it for next time.
 */
export function DrinkWater({ ml, counts, onChange }: { ml: number; counts: boolean; onChange: (counts: boolean) => void }) {
  const { colors } = useTheme();
  const { data: profile } = useProfile();
  const setting = useDrinkWaterSetting();
  if (!setting.ready || !setting.on) return null;
  return (
    <View style={[styles.box, { backgroundColor: counts ? colors.surface1 : colors.bg, borderColor: colors.hairline }]}>
      <Icon name="drop" size={18} color={counts ? 'water' : 'textTertiary'} />
      <View style={styles.flex}>
        <SwitchRow
          label="Counts toward water"
          description={counts ? `Adds ${formatDrink(ml, profile?.units ?? 'metric')} to today’s water` : 'Not counted. Use this when it was cooked down, like milk simmered into oats.'}
          value={counts}
          onChange={onChange}
          tint="water"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  flex: { flex: 1 },
});
