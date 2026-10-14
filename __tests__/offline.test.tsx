import { AuthApiError, AuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AuthProvider, OPEN_SAVED_AFTER_MS, useAuth } from '@/features/auth/AuthProvider';
import { cacheKey, QueryProvider, shouldSave } from '@/lib/queryCache';

type Listener = (event: string, session: Session | null) => void;

const mockAuth = {
  getSession: jest.fn(),
  listener: null as Listener | null,
  onAuthStateChange: jest.fn((cb: Listener) => {
    mockAuth.listener = cb;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }),
};
const mockSaved = { current: null as Session | null };

jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: () => Promise.resolve({ isConnected: true }),
  addNetworkStateListener: () => ({ remove: jest.fn() }),
}));

// Read lazily: the mock is built before the test's own variables are.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    get auth() {
      return mockAuth;
    },
  },
  savedSession: () => mockSaved.current,
}));

const session = (id: string) => ({ access_token: 'a', refresh_token: 'r', user: { id } }) as unknown as Session;

function Who() {
  const { session: s, initializing } = useAuth();
  return <Text>{initializing ? 'reading' : (s?.user.id ?? 'signed out')}</Text>;
}

async function signInState() {
  await render(
    <AuthProvider>
      <Who />
    </AuthProvider>,
  );
  await act(async () => {});
}

beforeEach(() => {
  mockAuth.getSession.mockReset();
  mockAuth.listener = null;
  mockSaved.current = null;
});

describe('opening the app offline', () => {
  it('keeps the saved sign-in when Supabase can’t be reached to renew it', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) });
    mockSaved.current = session('me');
    await signInState();
    expect(screen.getByText('me')).toBeTruthy();
  });

  it('doesn’t wait behind the splash screen while Supabase keeps retrying the renewal', async () => {
    jest.useFakeTimers();
    try {
      mockAuth.getSession.mockReturnValue(new Promise(() => {}));
      mockSaved.current = session('me');
      await signInState();
      expect(screen.getByText('reading')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(OPEN_SAVED_AFTER_MS);
      });
      expect(screen.getByText('me')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('signs out when Supabase says the sign-in is no longer valid', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found') });
    mockSaved.current = session('me');
    await signInState();
    expect(screen.getByText('signed out')).toBeTruthy();
  });

  it('ignores the empty first event that comes with an offline renewal, but follows real sign-outs', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) });
    mockSaved.current = session('me');
    await signInState();
    await act(async () => mockAuth.listener?.('INITIAL_SESSION', null));
    expect(screen.getByText('me')).toBeTruthy();
    await act(async () => mockAuth.listener?.('SIGNED_OUT', null));
    expect(screen.getByText('signed out')).toBeTruthy();
  });
});

describe('saved data', () => {
  const query = (key: string, status: 'success' | 'error' | 'pending' = 'success') =>
    ({ queryKey: [key], state: { status } }) as unknown as Parameters<typeof shouldSave>[0];

  it('keeps what you read, not lookups that act, searches or failures', () => {
    expect(shouldSave(query('foodLogs'))).toBe(true);
    expect(shouldSave(query('profile'))).toBe(true);
    expect(shouldSave(query('aiNutrients'))).toBe(false);
    expect(shouldSave(query('fillNutrients'))).toBe(false);
    expect(shouldSave(query('foodSearch'))).toBe(false);
    expect(shouldSave(query('foodLogs', 'error'))).toBe(false);
  });

  it('is saved per account', () => {
    expect(cacheKey('a')).not.toBe(cacheKey('b'));
  });

  it('starts afresh when another account signs in', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: session('a') }, error: null });
    const seen: string[] = [];
    const clients = new Set<QueryClient>();
    function Probe() {
      const client = useQueryClient();
      clients.add(client);
      const { session: s } = useAuth();
      const before = client.getQueryData<string>(['owner']);
      if (s && !before) client.setQueryData(['owner'], s.user.id);
      seen.push(`${s?.user.id}:${before ?? 'empty'}`);
      return null;
    }
    const { unmount } = await render(
      <AuthProvider>
        <QueryProvider>
          <Probe />
        </QueryProvider>
      </AuthProvider>,
    );
    await act(async () => {});
    await act(async () => mockAuth.listener?.('SIGNED_IN', session('b')));
    await act(async () => {});
    // b never sees a's data.
    expect(seen).not.toContain('b:a');
    expect(seen).toContain('b:empty');
    expect(clients.size).toBe(2);
    await unmount();
    // Saved queries live for days; drop them so nothing is left waiting.
    for (const c of clients) c.clear();
  });
});
