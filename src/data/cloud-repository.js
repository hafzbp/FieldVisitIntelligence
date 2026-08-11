import { getSupabase } from './supabase-client.js';

// Only send columns owned by the client. Server-managed audit/default columns such as
// created_at, updated_at and last_edited_by are intentionally omitted so PostgreSQL
// defaults/triggers remain the single source of truth.
const VISIT_FIELDS = [
  'id','jovis_user_id','visit_date','depot','salesman_name','salesman_id','route_segment',
  'notes','start_time','end_time','status','client_created_at','client_updated_at',
  'is_deleted','deleted_at'
];
const CALL_FIELDS = [
  'id','visit_id','jovis_user_id','outlet_id','outlet_name','route_status','result',
  'call_timestamp','omzet','observed_reason_code','custom_real_reason','contributing_factor',
  'evidence','sfa_reason_code','reason_match_status','sfa_selection_reason','revisit_plan',
  'can_revisit_earlier','followup_timing_reason','quick_note','client_created_at',
  'client_updated_at','is_deleted','deleted_at'
];

function pickDefined(row, fields){
  const out={};
  for(const key of fields){
    if(Object.prototype.hasOwnProperty.call(row||{},key) && row[key] !== undefined) out[key]=row[key];
  }
  return out;
}

export function sanitizeVisitPayload(row){return pickDefined(row,VISIT_FIELDS)}
export function sanitizeCallPayload(row){return pickDefined(row,CALL_FIELDS)}

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

export async function upsertVisit(row){
  const sb=await getSupabase();
  const payload=sanitizeVisitPayload(row);
  const {data,error}=await sb.from('visits').upsert(payload,{onConflict:'id'}).select().single();
  if(error)throw error;return data;
}
export async function upsertCall(row){
  const sb=await getSupabase();
  const payload=sanitizeCallPayload(row);
  const {data,error}=await sb.from('calls').upsert(payload,{onConflict:'id'}).select().single();
  if(error)throw error;return data;
}
export async function softDeleteCall(id){const sb=await getSupabase();const {data,error}=await sb.from('calls').update({is_deleted:true,deleted_at:new Date().toISOString()}).eq('id',id).select().single();if(error)throw error;return data}
export async function updateProfile(id,patch){const sb=await getSupabase();const {data,error}=await sb.from('profiles').update(patch).eq('id',id).select().single();if(error)throw error;return data}
export async function upsertReasonMapping(row){const sb=await getSupabase();const {data,error}=await sb.from('reason_mapping').upsert(row,{onConflict:'raw_reason_normalized'}).select().single();if(error)throw error;return data}

// Lightweight authenticated/RLS diagnostic. It does not bypass RLS; the counts and
// visible rows are exactly what the current user's policies permit.
export async function diagnosticSnapshot(){
  const sb=await getSupabase(); if(!sb) throw new Error('Supabase not configured');
  const [p,v,c] = await Promise.all([
    sb.from('profiles').select('id,display_name,email,role,active'),
    sb.from('visits').select('id,jovis_user_id,status,is_deleted'),
    sb.from('calls').select('id,visit_id,jovis_user_id,result,is_deleted')
  ]);
  for(const r of [p,v,c]) if(r.error) throw r.error;
  return {profiles:p.data||[],visits:v.data||[],calls:c.data||[]};
}
