import { useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { dismissInstallHint, installHintWanted } from '@/features/web/install';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const noChanges = () => () => {};

/** In Safari on an iPhone: how to put Fuel on the Home Screen, until you've done it or said "Got it". */
export function InstallHint() {
  const { colors } = useTheme();
  // The web build is made without a browser, so it starts hidden and the page decides once it loads.
  const wanted = useSyncExternalStore(noChanges, installHintWanted, () => false);
  const [dismissed, setDismissed] = useState(false);
  if (!wanted || dismissed) return null;
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
          <Icon name="share" size={18} color="accent" strokeWidth={2} />
        </View>
        <View style={styles.text}>
          <Text variant="bodyStrong">Add Fuel to your Home Screen</Text>
          <Text variant="small" color="textSecondary">
            Tap the Share button at the bottom of Safari, then <Text variant="smallStrong">Add to Home Screen</Text>. Fuel then opens full screen from its own icon,
            like an app, and stays signed in.
          </Text>
        </View>
      </View>
      <Button
        label="Got it"
        variant="ghost"
        onPress={() => {
          dismissInstallHint();
          setDismissed(true);
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.sm },
  head: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 4 },
});
