import { getSupabase } from '../data/supabase-client.js';
import { put, get } from '../data/local-db.js';

export async function signIn(email,password){
  const sb=await getSupabase(); if(!sb) throw new Error('Supabase not configured');
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error) throw error;
  return data;
}
export async function signOut(){const sb=await getSupabase(); if(sb) await sb.auth.signOut()}
export async function currentSession(){const sb=await getSupabase(); if(!sb) return null; const {data}=await sb.auth.getSession(); return data.session||null}
export async function currentUser(){const s=await currentSession();return s?.user||null}
export async function loadProfile(userId){
  const sb=await getSupabase();
  if(sb && navigator.onLine){
    const {data,error}=await sb.from('profiles').select('*').eq('id',userId).single();
    if(!error&&data){await put('profiles',data);return data}
  }
  return await get('profiles',userId);
}
