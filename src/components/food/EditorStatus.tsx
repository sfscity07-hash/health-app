import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ModalHeader } from '@/components/food/ModalHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';

type EditorStatusProps = {
  title: string;
  onClose: () => void;
  /** Leave out while loading; pass it to explain why nothing can be shown. */
  problem?: { title: string; body: string };
};

/** What a food editor shows while it loads, or when the food or entry can't be found. */
export function EditorStatus({ title, onClose, problem }: EditorStatusProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ModalHeader title={title} onClose={onClose} />
      <View style={styles.body}>
        {problem ? (
          <EmptyState icon="search" title={problem.title} body={problem.body} />
        ) : (
          <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" style={styles.spinner} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: gutter, paddingTop: space.xl },
  spinner: { marginTop: space.xxl },
});
