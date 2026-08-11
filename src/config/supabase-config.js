// Safe for GitHub Pages: use ONLY the Supabase Project URL + Publishable Key.
// NEVER place a Supabase secret key / service_role key in this repository.
export const SUPABASE_CONFIG = {
  url: 'PASTE_YOUR_SUPABASE_PROJECT_URL_HERE',
  publishableKey: 'PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE'
};

export function isSupabaseConfigured() {
  return /^https:\/\/.+\.supabase\.co\/?$/.test(SUPABASE_CONFIG.url)
    && /^sb_publishable_/.test(SUPABASE_CONFIG.publishableKey);
}
