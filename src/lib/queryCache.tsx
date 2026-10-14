import 'expo-sqlite/localStorage/install';

import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient, QueryClientProvider, type Query } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import * as Network from 'expo-network';
import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { updateId } from '@/features/updates/ota';

/**
 * Everything the app loads is kept on the phone, so it opens with your day,
 * weight and foods even with no signal, and refreshes once you're online.
 * Saving while offline still fails with a clear message rather than waiting.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Saved data older than this is dropped (it's refreshed whenever you're online anyway). */
const MAX_AGE = 14 * DAY;
/** Bump when what a query returns changes shape, so old saved data isn't read with new code. */
const SHAPE = 1;

/** Not kept: lookups that do something rather than read (fill nutrients, ask AI), and searches. */
const NOT_SAVED = new Set(['fillNutrients', 'aiNutrients', 'foodSearch']);

export const shouldSave = (query: Pick<Query, 'queryKey' | 'state'>) =>
  query.state.status === 'success' && !NOT_SAVED.has(String(query.queryKey[0]));

/** Each account's data is saved under its own key. */
export const cacheKey = (userId: string) => `fuel-query-cache:${userId}`;

// Web pre-rendering runs in Node, where there's no storage.
const storage = typeof window !== 'undefined' && typeof localStorage !== 'undefined' ? localStorage : null;
// A new app version or update starts from fresh data.
const buster = `${Constants.expoConfig?.version ?? ''}:${updateId ?? 'local'}:${SHAPE}`;

// On the phone, follow the connection, so queries wait (showing saved data) instead of failing.
// The web version uses the browser's own online events.
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) => {
    Network.getNetworkStateAsync()
      .then((s) => setOnline(s.isConnected !== false))
      .catch(() => {});
    const sub = Network.addNetworkStateListener((s) => setOnline(s.isConnected !== false));
    return () => sub.remove();
  });
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Kept as long as it's saved, or saved data would be dropped when nothing's showing it.
      queries: { retry: 1, gcTime: MAX_AGE },
      // Saving offline fails straight away (with "Check your connection") rather than waiting.
      mutations: { networkMode: 'always' },
    },
  });
}

/**
 * Queries for whoever is signed in. Signing in as someone else starts afresh,
 * so one account never sees another's data, and signing out deletes what was
 * saved on the phone. Waits (behind the splash screen) until the saved sign-in is read.
 */
export function QueryProvider({ children }: PropsWithChildren) {
  const { session, initializing } = useAuth();
  const userId = session?.user.id ?? null;
  const previous = useRef(userId);

  useEffect(() => {
    const gone = previous.current;
    previous.current = userId;
    if (!gone || gone === userId || !storage) return;
    // After the last save of the signed-out account's data has had time to land.
    setTimeout(() => {
      try {
        storage.removeItem(cacheKey(gone));
      } catch {
        // Nothing saved.
      }
    }, 3000);
  }, [userId]);

  if (initializing) return null;
  return (
    <AccountQueries key={userId ?? 'signed-out'} userId={userId}>
      {children}
    </AccountQueries>
  );
}

function AccountQueries({ userId, children }: PropsWithChildren<{ userId: string | null }>) {
  const [client] = useState(makeQueryClient);
  const persister = useMemo(
    () => (userId && storage ? createAsyncStoragePersister({ storage, key: cacheKey(userId), throttleTime: 1000 }) : null),
    [userId],
  );
  if (!persister) return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{ persister, maxAge: MAX_AGE, buster, dehydrateOptions: { shouldDehydrateQuery: shouldSave } }}>
      {children}
    </PersistQueryClientProvider>
  );
}
