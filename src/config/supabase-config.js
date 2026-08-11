// Safe for GitHub Pages: use ONLY the Supabase Project URL + Publishable Key.
// NEVER place a Supabase secret key / service_role key in this repository.
export const SUPABASE_CONFIG = {
  url: 'https://gxwysmjttzqppiadryjc.supabase.co',
  publishableKey: 'sb_publishable_7aGBaUmYSIHa0_YOsrue8g_SyqkWIYG'
};

export function isSupabaseConfigured() {
  return /^https:\/\/.+\.supabase\.co\/?$/.test(SUPABASE_CONFIG.url)
    && /^sb_publishable_/.test(SUPABASE_CONFIG.publishableKey);
}
