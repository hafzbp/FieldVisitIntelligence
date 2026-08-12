import { pct, num, normalize } from '../config/utils.js';
import {
  actualReasonKey, observedLabel, sfaLabel, legacySfaLabel, exactSfaCode,
  analysisReasonStatus, normalizedRecoveryStatus, safeLegacyExactCode
} from './reason-engine.js';

export function analyze(visits=[],calls=[],taxonomy=[],lang='id'){
  const activeCalls=calls.filter(c=>!c.is_deleted);
  const physicalCalls=activeCalls.filter(c=>(c.call_method||'VISIT')==='VISIT');
  const waCalls=activeCalls.filter(c=>c.call_method==='WHATSAPP');
  const sc=physicalCalls.length;
  const ecCalls=physicalCalls.filter(c=>c.result==='EC');
  const neCalls=physicalCalls.filter(c=>c.result==='NON_EC');
  const status={MATCH:0,PARTIAL:0,MISMATCH:0,UNCLEAR:0,UNRESOLVED:0,NON_CAUSAL:0,TAXONOMY_GAP:0};
  const quality={EXACT_CAPTURED:0,AUTO_RECOVERED:0,MANUAL_CONFIRMED:0,UNRESOLVED:0};

  neCalls.forEach(c=>{
    const s=analysisReasonStatus(c)||'UNCLEAR';status[s]=(status[s]||0)+1;
    const q=normalizedRecoveryStatus(c)||'UNRESOLVED';quality[q]=(quality[q]||0)+1;
  });
  const evaluable=status.MATCH+status.PARTIAL+status.MISMATCH;
  const resolved=neCalls.length-status.UNRESOLVED;

  const observedCounts={},observedLabels={},sfaCounts={},sfaLabels={},matrix={},followCounts={},customReasons={};
  neCalls.forEach(c=>{
    const ok=actualReasonKey(c); const ol=observedLabel(c,taxonomy,lang)||ok; observedLabels[ok]=ol;observedCounts[ok]=(observedCounts[ok]||0)+1;
    const exact=exactSfaCode(c)||safeLegacyExactCode(c);const sk=exact||'__UNRESOLVED__';
    sfaLabels[sk]=exact?sfaLabel({...c,sfa_reason_exact_code:exact},taxonomy,lang):(lang==='id'?'Legacy belum dikonfirmasi':'Unresolved legacy');
    sfaCounts[sk]=(sfaCounts[sk]||0)+1;
    matrix[sk]??={};matrix[sk][ok]=(matrix[sk][ok]||0)+1;
    const fp=c.revisit_plan||'UNKNOWN';followCounts[fp]=(followCounts[fp]||0)+1;
    if(c.observed_reason_code==='other'&&c.custom_real_reason){const n=normalize(c.custom_real_reason);customReasons[n]??={label:c.custom_real_reason.trim(),count:0,cases:[]};customReasons[n].count++;customReasons[n].cases.push(c)}
  });

  const bySfa={};
  for(const code of Object.keys(sfaCounts)){
    const xs=neCalls.filter(c=>((exactSfaCode(c)||safeLegacyExactCode(c)||'__UNRESOLVED__')===code));
    const s={MATCH:0,PARTIAL:0,MISMATCH:0,UNCLEAR:0,UNRESOLVED:0,NON_CAUSAL:0,TAXONOMY_GAP:0};
    xs.forEach(c=>{const z=analysisReasonStatus(c)||'UNCLEAR';s[z]=(s[z]||0)+1});
    const ev=s.MATCH+s.PARTIAL+s.MISMATCH;
    bySfa[code]={n:xs.length,...s,evaluable:ev,exactRate:pct(s.MATCH,ev),mismatchRate:pct(s.MISMATCH,ev)};
  }

  const visitSummaries=visits.map(v=>{const all=activeCalls.filter(c=>c.visit_id===v.id),cs=all.filter(c=>(c.call_method||'VISIT')==='VISIT'),wa=all.filter(c=>c.call_method==='WHATSAPP'),ec=cs.filter(c=>c.result==='EC').length;return {visit:v,sc:cs.length,ec,ne:cs.length-ec,ecsc:pct(ec,cs.length),revenue:cs.filter(c=>c.result==='EC').reduce((a,c)=>a+num(c.omzet),0),waEc:wa.length,waRevenue:wa.reduce((a,c)=>a+num(c.omzet),0)}});
  return {
    sc,ec:ecCalls.length,ne:neCalls.length,ecsc:pct(ecCalls.length,sc),totalRevenue:ecCalls.reduce((a,c)=>a+num(c.omzet),0),avgRevenueEc:ecCalls.length?ecCalls.reduce((a,c)=>a+num(c.omzet),0)/ecCalls.length:0,waEc:waCalls.length,waRevenue:waCalls.reduce((a,c)=>a+num(c.omzet),0),
    status,quality,resolvedSfa:resolved,sfaCoverage:pct(resolved,neCalls.length),evaluable,
    exactRate:pct(status.MATCH,evaluable),mismatchRate:pct(status.MISMATCH,evaluable),observedCounts,observedLabels,sfaCounts,sfaLabels,matrix,followCounts,customReasons,bySfa,visitSummaries,
    topObserved:Object.entries(observedCounts).sort((a,b)=>b[1]-a[1])[0]||null,
    topMismatch:Object.entries(bySfa).filter(([,x])=>x.evaluable>=3).sort((a,b)=>b[1].mismatchRate-a[1].mismatchRate)[0]||null,
    unresolvedLegacy:neCalls.filter(c=>analysisReasonStatus(c)==='UNRESOLVED'),
    legacyCalls:neCalls.filter(c=>(c.sfa_capture_type||'LEGACY')==='LEGACY'),
    legacyLabels:Object.fromEntries(neCalls.map(c=>[c.id,legacySfaLabel(c,taxonomy,lang)]))
  };
}

export function buildFindings(a,taxonomy,lang='id'){
  const out=[];
  const t=code=>a.sfaLabels?.[code]||taxonomy.find(x=>x.reason_code===code)?.[lang==='id'?'reason_label_id':'reason_label_en']||code;
  if(a.ne===0) return out;
  if(a.status.UNRESOLVED){
    out.push({title:lang==='id'?'SFA legacy belum selesai direcover':'Legacy SFA recovery incomplete',text:lang==='id'?`${a.status.UNRESOLVED} dari ${a.ne} Non-EC belum punya exact reason E-Work. Row ini dikeluarkan dari perhitungan mismatch sampai dikonfirmasi.`:`${a.status.UNRESOLVED} of ${a.ne} Non-EC rows do not yet have an exact E-Work reason and are excluded from mismatch calculation.`});
  }
  if(a.status.NON_CAUSAL){
    out.push({title:'"Nanti ditelpon saja" bukan root cause',text:lang==='id'?`${a.status.NON_CAUSAL} case menggunakan opsi SFA "Nanti ditelpon saja". Opsi ini diperlakukan sebagai disposition/follow-up dan tidak dipaksa menjadi Match atau Mismatch.`:`${a.status.NON_CAUSAL} cases use the SFA option "Call later"; it is treated as a disposition rather than a causal reason.`});
  }
  if(a.status.TAXONOMY_GAP){
    out.push({title:lang==='id'?'SFA Lainnya = kandidat taxonomy gap':'SFA Other = taxonomy-gap candidate',text:lang==='id'?`${a.status.TAXONOMY_GAP} case menggunakan exact SFA "Lainnya". Review actual reason + evidence untuk melihat reason E-Work yang belum tersedia.`:`${a.status.TAXONOMY_GAP} cases use exact SFA Other; review actual reason and evidence for missing taxonomy.`});
  }
  if(a.topMismatch && a.topMismatch[1].n>=3){
    out.push({title:lang==='id'?'Reason comparable dengan mismatch tertinggi':'Highest mismatch among comparable reasons',text:`${t(a.topMismatch[0])}: ${a.topMismatch[1].mismatchRate}% mismatch (${a.topMismatch[1].MISMATCH}/${a.topMismatch[1].evaluable} evaluable case).`});
  }
  const custom=Object.values(a.customReasons).sort((x,y)=>y.count-x.count);
  if(custom.length) out.push({title:lang==='id'?'Actual taxonomy discovery':'Actual taxonomy discovery',text:`${custom.reduce((s,x)=>s+x.count,0)} case menggunakan alasan riil di luar taxonomy existing; ${custom.length} wording unik perlu direview.`});
  const noFollow=a.followCounts.NONE||0;if(noFollow)out.push({title:lang==='id'?'Non-EC tanpa follow-up plan':'Non-EC without follow-up plan',text:`${noFollow} dari ${a.ne} Non-EC (${pct(noFollow,a.ne)}%) tercatat tanpa rencana follow-up.`});
  return out;
}

export { observedLabel, sfaLabel, legacySfaLabel, exactSfaCode, analysisReasonStatus } from './reason-engine.js';
