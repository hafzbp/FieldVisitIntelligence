import { getSupabase } from './supabase-client.js';

export async function fetchDataset(){
  const sb=await getSupabase(); if(!sb) throw new Error('Supabase not configured');
  const [p,v,c,t,m] = await Promise.all([
    sb.from('profiles').select('*'),
    sb.from('visits').select('*').eq('is_deleted',false).order('start_time',{ascending:false}),
    sb.from('calls').select('*').eq('is_deleted',false).order('call_timestamp',{ascending:true}),
    sb.from('reason_taxonomy').select('*').eq('active',true).order('sort_order',{ascending:true}),
    sb.from('reason_mapping').select('*').eq('active',true)
  ]);
  for(const r of [p,v,c,t,m]) if(r.error) throw r.error;
  return {profiles:p.data||[],visits:v.data||[],calls:c.data||[],taxonomy:t.data||[],reasonMappings:m.data||[]};
}

export async function upsertVisit(row){const sb=await getSupabase();const {data,error}=await sb.from('visits').upsert(row,{onConflict:'id'}).select().single();if(error)throw error;return data}
export async function upsertCall(row){const sb=await getSupabase();const {data,error}=await sb.from('calls').upsert(row,{onConflict:'id'}).select().single();if(error)throw error;return data}
export async function softDeleteCall(id){const sb=await getSupabase();const {data,error}=await sb.from('calls').update({is_deleted:true,deleted_at:new Date().toISOString()}).eq('id',id).select().single();if(error)throw error;return data}
export async function updateProfile(id,patch){const sb=await getSupabase();const {data,error}=await sb.from('profiles').update(patch).eq('id',id).select().single();if(error)throw error;return data}
export async function upsertReasonMapping(row){const sb=await getSupabase();const {data,error}=await sb.from('reason_mapping').upsert(row,{onConflict:'raw_reason_normalized'}).select().single();if(error)throw error;return data}
