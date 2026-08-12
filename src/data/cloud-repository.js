import { getSupabase } from './supabase-client.js';

const VISIT_FIELDS = [
  'id','jovis_user_id','visit_date','depot','salesman_name','salesman_id','route_segment',
  'notes','start_time','end_time','status','client_created_at','client_updated_at',
  'is_deleted','deleted_at'
];
const CALL_FIELDS = [
  'id','visit_id','jovis_user_id','outlet_id','outlet_name','route_status','result','call_method',
  'call_timestamp','checkin_at','checkout_at','checkin_latitude','checkin_longitude','checkin_accuracy_m',
  'checkout_latitude','checkout_longitude','checkout_accuracy_m','duration_seconds','omzet',
  'observed_reason_code','custom_real_reason','contributing_factor','evidence','sfa_reason_code',
  'sfa_reason_exact_code','sfa_capture_type','sfa_recovery_status','reason_match_status','sfa_selection_reason',
  'revisit_plan','can_revisit_earlier','followup_timing_reason','quick_note','client_created_at','client_updated_at',
  'is_deleted','deleted_at'
];
const REASON_DETAIL_FIELDS = [
  'call_id','jovis_user_id','recoverable_today','preferred_recovery_channel','best_followup_time','pic_status',
  'pic_expected_return','closed_status','closed_expected_open','financial_status','cash_available_when',
  'partial_order_possible','refusal_driver','expected_next_order','price_issue_type','price_detail','product_issue_type','affected_products','external_supplier_name','external_supplier_driver',
  'normal_buying_cycle','last_order_date','last_delivery_date','salesman_bombing_claim','salesman_bombing_reason',
  'detail_notes','source_version'
];
const STOCK_ITEM_FIELDS=['id','call_id','jovis_user_id','product_name','stock_level','qty_note','notes'];
const RECOVERY_FIELDS=['id','call_id','visit_id','jovis_user_id','attempted_at','channel','outcome','omzet','notes','client_created_at','client_updated_at'];
const PHOTO_FIELDS=['id','call_id','jovis_user_id','storage_path','photo_type','caption','mime_type','size_bytes','created_at'];

function pickDefined(row, fields){const out={};for(const key of fields){if(Object.prototype.hasOwnProperty.call(row||{},key)&&row[key]!==undefined)out[key]=row[key]}return out}

export function sanitizeVisitPayload(row){
  const payload=pickDefined(row,VISIT_FIELDS);
  if(!['active','completed'].includes(payload.status))payload.status=row?.end_time?'completed':'active';
  return payload;
}
export function sanitizeCallPayload(row){return pickDefined(row,CALL_FIELDS)}
export function sanitizeReasonDetailPayload(row){return pickDefined(row,REASON_DETAIL_FIELDS)}
export function sanitizeStockItemPayload(row){return pickDefined(row,STOCK_ITEM_FIELDS)}
export function sanitizeRecoveryPayload(row){return pickDefined(row,RECOVERY_FIELDS)}
export function sanitizePhotoPayload(row){return pickDefined(row,PHOTO_FIELDS)}

export async function fetchDataset(){
  const sb=await getSupabase();if(!sb)throw new Error('Supabase not configured');
  // Core field data is mandatory. Rich v0.4 child tables are loaded separately so
  // a permission/schema problem in one optional table can never hide Visits/Calls
  // from Admin or JOVIS. Diagnostics still report every degraded table explicitly.
  const [p,v,c,t,m]=await Promise.all([
    sb.from('profiles').select('*'),
    sb.from('visits').select('*').order('start_time',{ascending:false}),
    sb.from('calls').select('*').order('call_timestamp',{ascending:true}),
    sb.from('reason_taxonomy').select('*').eq('active',true).order('sort_order',{ascending:true}),
    sb.from('reason_mapping').select('*').eq('active',true)
  ]);
  for(const r of [p,v,c,t,m])if(r.error)throw r.error;

  const optional=await Promise.allSettled([
    sb.from('call_reason_details').select('*'),
    sb.from('call_stock_items').select('*').order('created_at',{ascending:true}),
    sb.from('call_recovery_attempts').select('*').order('attempted_at',{ascending:true}),
    sb.from('call_photos').select('*').order('created_at',{ascending:true}),
    sb.from('app_settings').select('*')
  ]);
  const names=['call_reason_details','call_stock_items','call_recovery_attempts','call_photos','app_settings'];
  const values=[];const warnings=[];
  optional.forEach((settled,i)=>{
    if(settled.status==='rejected'){
      warnings.push(`${names[i]}: ${settled.reason?.message||settled.reason}`);values.push([]);return;
    }
    const r=settled.value;
    if(r?.error){warnings.push(`${names[i]}: ${r.error.message||r.error}`);values.push([]);return;}
    values.push(r?.data||[]);
  });
  const [rd,si,ra,ph,aset]=values;
  return {profiles:p.data||[],visits:v.data||[],calls:c.data||[],taxonomy:t.data||[],reasonMappings:m.data||[],reasonDetails:rd||[],stockItems:si||[],recoveryAttempts:ra||[],photos:ph||[],appSettings:aset||[],warnings};
}

async function upsert(table,row,fields,onConflict='id'){
  const sb=await getSupabase();
  const payload=pickDefined(row,fields);
  const {data,error}=await sb.from(table).upsert(payload,{onConflict}).select().single();
  if(error)throw error;return data;
}
export async function upsertVisit(row){return upsert('visits',sanitizeVisitPayload(row),VISIT_FIELDS,'id')}
export async function upsertCall(row){return upsert('calls',sanitizeCallPayload(row),CALL_FIELDS,'id')}
export async function upsertReasonDetail(row){return upsert('call_reason_details',sanitizeReasonDetailPayload(row),REASON_DETAIL_FIELDS,'call_id')}
export async function upsertStockItem(row){return upsert('call_stock_items',sanitizeStockItemPayload(row),STOCK_ITEM_FIELDS,'id')}
export async function upsertRecoveryAttempt(row){return upsert('call_recovery_attempts',sanitizeRecoveryPayload(row),RECOVERY_FIELDS,'id')}
export async function upsertPhoto(row){return upsert('call_photos',sanitizePhotoPayload(row),PHOTO_FIELDS,'id')}

export async function deleteReasonDetail(callId){const sb=await getSupabase();const {error}=await sb.from('call_reason_details').delete().eq('call_id',callId);if(error)throw error;return true}
export async function deleteStockItem(id){const sb=await getSupabase();const {error}=await sb.from('call_stock_items').delete().eq('id',id);if(error)throw error;return true}
export async function softDeleteCall(id){const sb=await getSupabase();const {data,error}=await sb.from('calls').update({is_deleted:true,deleted_at:new Date().toISOString()}).eq('id',id).select().single();if(error)throw error;return data}
export async function updateProfile(id,patch){const sb=await getSupabase();const {data,error}=await sb.from('profiles').update(patch).eq('id',id).select().single();if(error)throw error;return data}
export async function updateTaxonomy(code,patch){const sb=await getSupabase();const {data,error}=await sb.from('reason_taxonomy').update(patch).eq('reason_code',code).select().single();if(error)throw error;return data}
export async function updateAppSetting(key,value){const sb=await getSupabase();const {data,error}=await sb.from('app_settings').update({setting_value:value}).eq('setting_key',key).select().single();if(error)throw error;return data}
export async function upsertReasonMapping(row){const sb=await getSupabase();const {data,error}=await sb.from('reason_mapping').upsert(row,{onConflict:'raw_reason_normalized'}).select().single();if(error)throw error;return data}

export async function uploadPhotoBlob(storagePath,blob,contentType='image/webp'){
  const sb=await getSupabase();const {data,error}=await sb.storage.from('call-evidence').upload(storagePath,blob,{contentType,upsert:true,cacheControl:'3600'});if(error)throw error;return data;
}
export async function createPhotoSignedUrl(storagePath,expiresIn=900){
  const sb=await getSupabase();const {data,error}=await sb.storage.from('call-evidence').createSignedUrl(storagePath,expiresIn);if(error)throw error;return data?.signedUrl||null;
}

export async function diagnosticSnapshot(){
  const sb=await getSupabase();if(!sb)throw new Error('Supabase not configured');
  const [p,v,c,rd,ra]=await Promise.all([
    sb.from('profiles').select('id,display_name,email,role,active'),
    sb.from('visits').select('id,jovis_user_id,status,is_deleted'),
    sb.from('calls').select('id,visit_id,jovis_user_id,result,call_method,is_deleted'),
    sb.from('call_reason_details').select('call_id,jovis_user_id,recoverable_today'),
    sb.from('call_recovery_attempts').select('id,call_id,jovis_user_id,outcome')
  ]);
  for(const r of [p,v,c,rd,ra])if(r.error)throw r.error;
  return {profiles:p.data||[],visits:v.data||[],calls:c.data||[],reasonDetails:rd.data||[],recoveryAttempts:ra.data||[]};
}
