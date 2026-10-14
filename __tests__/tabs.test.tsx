import { act, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import TabLayout from '@/app/(tabs)/_layout';

jest.mock('@/lib/supabase', () => ({ supabase: null, requireSupabase: jest.fn() }));
// Reminders need notifications and data; the tab bar doesn't.
jest.mock('@/features/reminders/usePlanner', () => ({ useReminderPlanner: () => undefined }));

/** Walks up from a node and says whether anything above it is hidden with display: none. */
function hidden(node: { props: { style?: unknown }; parent: unknown } | null): boolean {
  for (let n = node; n; n = n.parent as typeof node) {
    const style = [n.props.style].flat(Infinity) as ({ display?: string } | null | undefined)[];
    if (style.some((s) => s?.display === 'none')) return true;
  }
  return false;
}

describe('the tab bar', () => {
  it('shows each tab’s content when you switch to it, in plain views rather than native screens', async () => {
    await renderRouter(
      {
        '(tabs)/_layout': TabLayout,
        '(tabs)/index': () => <Text>Home content</Text>,
        '(tabs)/food-log': () => <Text>Food log content</Text>,
        '(tabs)/progress': () => <Text>Progress content</Text>,
        '(tabs)/profile': () => <Text>Profile content</Text>,
      },
      { initialUrl: '/' },
    );
    expect(hidden(screen.getByText('Home content'))).toBe(false);

    for (const [href, content] of [
      ['/food-log', 'Food log content'],
      ['/progress', 'Progress content'],
      ['/profile', 'Profile content'],
      ['/', 'Home content'],
    ] as const) {
      await act(async () => router.navigate(href));
      // The router renders with fake timers; let the switch finish.
      await act(async () => jest.runOnlyPendingTimers());
      expect(hidden(screen.getByText(content))).toBe(false);
      expect(screen.getByRole('tab', { name: { '/food-log': 'Food log', '/progress': 'Progress', '/profile': 'Profile', '/': 'Dashboard' }[href] })).toBeSelected();
    }
    // Hidden tabs stay built but out of sight.
    expect(hidden(screen.getByText('Food log content', { includeHiddenElements: true }))).toBe(true);
    // No native screen container: on Android it ignored display and left tabs blank.
    expect(JSON.stringify(screen.toJSON())).not.toContain('"RNSScreen');
  });
});
