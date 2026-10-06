import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { gutter, space } from '@/theme/tokens';

/** Top bar for full-screen editors: close on the left, a small title, an optional action on the right. */
export function ModalHeader({ title, onClose, right }: { title: string; onClose: () => void; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + space.xs }]}>
      <IconButton icon="chevronLeft" label="Back" onPress={onClose} />
      <Text variant="smallStrong" color="textSecondary">
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: gutter - 4, paddingBottom: space.sm },
  right: { width: 40, alignItems: 'flex-end' },
});
