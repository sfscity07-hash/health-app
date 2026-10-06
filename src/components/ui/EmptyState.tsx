import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

type EmptyStateProps = {
  icon: IconName;
  title: string;
  body: string;
};

/** Friendly placeholder that says what will appear here and how to get it. */
export function EmptyState({ icon, title, body }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <Card style={styles.card}>
      <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
        <Icon name={icon} size={18} color="accent" />
      </View>
      <View style={styles.text}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" color="textSecondary">
          {body}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: space.md, padding: space.lg, alignItems: 'flex-start' },
  icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: space.xs },
});
