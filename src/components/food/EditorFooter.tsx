import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';

type EditorFooterProps = {
  label: string;
  trailing?: string;
  onPress: () => void;
  loading?: boolean;
  error?: string | null;
  /** Shows "Delete entry", which asks for a second tap before it deletes. */
  onDelete?: () => void;
  deleting?: boolean;
};

/** The pinned action bar at the bottom of the food editors. */
export function EditorFooter({ label, trailing, onPress, loading, error, onDelete, deleting }: EditorFooterProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + space.md, backgroundColor: colors.bg, borderTopColor: colors.hairline }]}>
      {error ? (
        <Text variant="small" color="warn" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button label={label} trailing={trailing} loading={loading} onPress={onPress} />
      {onDelete ? (
        <Button
          label={confirmDelete ? 'Tap again to delete' : 'Delete entry'}
          variant="danger"
          loading={deleting}
          onPress={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: gutter, paddingTop: space.md, gap: space.xs, borderTopWidth: StyleSheet.hairlineWidth },
});
