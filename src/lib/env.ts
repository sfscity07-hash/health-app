/**
 * Public configuration read from `.env` (see `.env.example`). Expo inlines
 * `EXPO_PUBLIC_*` variables at build time, so they must be accessed directly
 * as `process.env.EXPO_PUBLIC_…`.
 */
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

/** False until you add your Supabase URL and publishable (anon) key to `.env`. */
export const isSupabaseConfigured = supabaseUrl.startsWith('https://') && supabaseKey.length > 0;
