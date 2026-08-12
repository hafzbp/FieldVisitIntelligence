import { normalize } from '../config/utils.js';
import { EXACT_SFA_CODES, SAFE_LEGACY_SFA_MAP, SFA_TO_OBSERVED_REASON } from '../config/app-config.js';

function labelByCode(code,taxonomy,lang='id'){
  const r=taxonomy.find(x=>x.reason_code===code);
  return r ? (lang==='id'?r.reason_label_id:r.reason_label_en) : (code||'');
}

export function observedLabel(call,taxonomy,lang='id'){
  if(call.observed_reason_code==='other' && call.custom_real_reason) return call.custom_real_reason.trim();
  return labelByCode(call.observed_reason_code,taxonomy,lang);
}

export function exactSfaCode(call){
  if(call?.sfa_reason_exact_code) return call.sfa_reason_exact_code;
  const raw=call?.sfa_reason_code||'';
  return EXACT_SFA_CODES.has(raw) ? raw : null;
}

export function sfaLabel(call,taxonomy,lang='id'){
  const exact=exactSfaCode(call);
  return labelByCode(exact||call?.sfa_reason_code,taxonomy,lang);
}

export function legacySfaLabel(call,taxonomy,lang='id'){
  if(call?.sfa_capture_type==='EXACT') return '';
  const raw=call?.sfa_reason_code||'';
  if(!raw || EXACT_SFA_CODES.has(raw)) return '';
  return labelByCode(raw,taxonomy,lang);
}

export function safeLegacyExactCode(call){
  if(!call || call.result!=='NON_EC') return null;
  return SAFE_LEGACY_SFA_MAP[call.sfa_reason_code]||null;
}

export function normalizedRecoveryStatus(call){
  if(call?.result!=='NON_EC') return null;
  if(call.sfa_recovery_status) return call.sfa_recovery_status;
  if(exactSfaCode(call) && EXACT_SFA_CODES.has(call.sfa_reason_code)) return 'EXACT_CAPTURED';
  if(safeLegacyExactCode(call)) return 'AUTO_RECOVERED';
  return 'UNRESOLVED';
}

export function normalizedCaptureType(call){
  if(call?.result!=='NON_EC') return null;
  if(call.sfa_capture_type) return call.sfa_capture_type;
  return EXACT_SFA_CODES.has(call.sfa_reason_code||'') ? 'EXACT' : 'LEGACY';
}

export function classifyReason(call){
  if(call?.result!=='NON_EC') return null;
  const exact=exactSfaCode(call)||safeLegacyExactCode(call);
  if(!exact) return 'UNCLEAR';
  // These options are not causal one-to-one reasons, so do not force a mismatch.
  if(exact==='sfa_call_later' || exact==='sfa_other') return 'UNCLEAR';
  if(!call.observed_reason_code || call.observed_reason_code==='unclear') return 'UNCLEAR';
  const expectedObserved=SFA_TO_OBSERVED_REASON[exact];
  if(!expectedObserved) return 'UNCLEAR';
  if(call.observed_reason_code===expectedObserved) return 'MATCH';
  if(call.contributing_factor===expectedObserved) return 'PARTIAL';
  return 'MISMATCH';
}

export function analysisReasonStatus(call){
  if(call?.result!=='NON_EC') return null;
  const exact=exactSfaCode(call)||safeLegacyExactCode(call);
  if(!exact) return 'UNRESOLVED';
  if(exact==='sfa_call_later') return 'NON_CAUSAL';
  if(exact==='sfa_other') return 'TAXONOMY_GAP';
  return classifyReason({...call,sfa_reason_exact_code:exact});
}

export function dbCompatibleMatchStatus(call){
  const s=analysisReasonStatus(call);
  return ['MATCH','PARTIAL','MISMATCH'].includes(s) ? s : 'UNCLEAR';
}

export function actualReasonKey(call){
  if(call.observed_reason_code==='other' && call.custom_real_reason) return `custom:${normalize(call.custom_real_reason)}`;
  return call.observed_reason_code||'unclear';
}

export function recoverySuggestion(call){
  if(call?.result!=='NON_EC' || exactSfaCode(call)) return null;
  const why=normalize(call.sfa_selection_reason||'');
  const evidence=normalize(call.evidence||'');
  const combined=`${why} ${evidence}`;
  if(/nanti\s+(di\s*)?telp(on|on)?\s+saja|nanti\s+ditelpon\s+saja|pilih\s+opsi.*telp/.test(combined)){
    return {code:'sfa_call_later',confidence:'HIGH',reason:'Catatan legacy secara eksplisit menyebut opsi "Nanti ditelpon saja".'};
  }
  if(call.sfa_reason_code==='pic' && /(pemilik|owner|pic).*(tidak ada|gaada|gak ada|nggak ada|tidak ditempat|tidak di tempat)/.test(combined)){
    return {code:'sfa_owner_absent',confidence:'MEDIUM',reason:'Catatan menunjukkan pemilik/PIC tidak berada di tempat; tetap perlu konfirmasi karena legacy PIC ambigu.'};
  }
  return null;
}
