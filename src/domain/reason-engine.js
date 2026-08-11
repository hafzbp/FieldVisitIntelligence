import { normalize } from '../config/utils.js';

export function observedLabel(call,taxonomy,lang='id'){
  if(call.observed_reason_code==='other' && call.custom_real_reason) return call.custom_real_reason.trim();
  const r=taxonomy.find(x=>x.reason_code===call.observed_reason_code);
  return r ? (lang==='id'?r.reason_label_id:r.reason_label_en) : (call.observed_reason_code||'');
}
export function sfaLabel(call,taxonomy,lang='id'){
  const r=taxonomy.find(x=>x.reason_code===call.sfa_reason_code);
  return r ? (lang==='id'?r.reason_label_id:r.reason_label_en) : (call.sfa_reason_code||'');
}
export function classifyReason(call){
  if(call.result!=='NON_EC') return null;
  if(!call.observed_reason_code || call.observed_reason_code==='unclear' || !call.sfa_reason_code || call.sfa_reason_code==='unclear') return 'UNCLEAR';
  if(call.observed_reason_code===call.sfa_reason_code) return 'MATCH';
  if(call.contributing_factor===call.sfa_reason_code) return 'PARTIAL';
  return 'MISMATCH';
}
export function actualReasonKey(call){
  if(call.observed_reason_code==='other' && call.custom_real_reason) return `custom:${normalize(call.custom_real_reason)}`;
  return call.observed_reason_code||'unclear';
}
