import { SUPABASE_CONFIG, isSupabaseConfigured } from '../config/supabase-config.js';
let client=null;
export async function getSupabase(){
  if(client) return client;
  if(!isSupabaseConfigured()) return null;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm');
  client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  return client;
}
export { isSupabaseConfigured };
