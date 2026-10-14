import 'expo-sqlite/localStorage/install';

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { isSupabaseConfigured, supabaseKey, supabaseUrl } from '@/lib/env';

/**
 * The Supabase client, or `null` until `.env` has your project's URL and key.
 * Sessions persist in on-device storage (expo-sqlite's localStorage), which
 * has no size limit, unlike SecureStore's 2 KB cap that large sessions exceed.
 */
// Web pre-rendering runs in Node, where there is no window and nothing to persist.
const isServer = typeof window === 'undefined';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: isServer ? undefined : localStorage,
        autoRefreshToken: !isServer,
        persistSession: !isServer,
        detectSessionInUrl: false,
      },
    })
  : null;

// Refresh the session only while the app is in the foreground.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** The client, or a clear error if `.env` isn't filled in yet. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured. Add your URL and key to .env and restart the app.');
  return supabase;
}

/**
 * The sign-in saved on this phone, even when its hour-long access token has
 * run out. Offline, Supabase can't renew it, but it's still yours: the app
 * keeps using it for saved data, and Supabase renews it once you're back online.
 */
export function savedSession(): Session | null {
  const key = (supabase?.auth as unknown as { storageKey?: string } | undefined)?.storageKey;
  if (!key || isServer) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as Session | null;
    return saved?.access_token && saved.refresh_token && saved.user?.id ? saved : null;
  } catch {
    return null;
  }
}
