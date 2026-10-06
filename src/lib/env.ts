/**
 * Public configuration read from `.env`. Expo inlines `EXPO_PUBLIC_*`
 * variables at build time, so they must be accessed directly as
 * `process.env.EXPO_PUBLIC_…`.
 */

/**
 * Supabase's dashboard also shows the REST endpoint (`…supabase.co/rest/v1/`).
 * The client adds those paths itself, so trim them and any trailing slash.
 */
export function normalizeSupabaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(rest|auth)\/v1$/, '')
    .replace(/\/+$/, '');
}

export const supabaseUrl = normalizeSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');
export const supabaseKey = (process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '').trim();

/** False until you add your Supabase URL and publishable (anon) key to `.env`. */
export const isSupabaseConfigured = supabaseUrl.startsWith('https://') && supabaseKey.length > 0;
