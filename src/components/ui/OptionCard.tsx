import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

type OptionCardProps = {
  title: string;
  description?: string;
  /** Small text on the right, e.g. "Recommended" or "−550 kcal". */
  note?: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
};

/** A large single-choice option. Used in onboarding and settings. */
export function OptionCard({ title, description, note, icon, selected, onPress }: OptionCardProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[title, description, note].filter(Boolean).join(', ')}
      haptic="tick"
      pressedScale={0.98}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: selected ? colors.accentSoft : colors.surface1,
          borderColor: selected ? colors.accent : colors.hairline,
        },
      ]}>
      {icon ? (
        <View style={[styles.icon, { backgroundColor: selected ? colors.accent : colors.surface2 }]}>
          <Icon name={icon} size={18} color={selected ? 'accentInk' : 'accent'} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="bodyStrong">{title}</Text>
        {description ? (
          <Text variant="small" color="textSecondary">
            {description}
          </Text>
        ) : null}
      </View>
      {note ? (
        <Text variant="caption" color={selected ? 'accent' : 'textSecondary'} tabular>
          {note}
        </Text>
      ) : null}
      <View
        style={[
          styles.radio,
          { borderColor: selected ? colors.accent : colors.hairlineStrong, backgroundColor: selected ? colors.accent : 'transparent' },
        ]}>
        {selected ? <Icon name="check" size={12} color="accentInk" strokeWidth={3} /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg + 2,
    borderWidth: 1.5,
  },
  icon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
