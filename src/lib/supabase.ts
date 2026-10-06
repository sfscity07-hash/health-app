import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { isSupabaseConfigured, supabaseKey, supabaseUrl } from '@/lib/env';

/**
 * The Supabase client, or `null` until `.env` has your project's URL and key.
 * Sessions persist in on-device storage (expo-sqlite's localStorage), which
 * has no size limit, unlike SecureStore's 2 KB cap that large sessions exceed.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
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
