import { pct, num, normalize } from '../config/utils.js';
import { actualReasonKey, observedLabel, sfaLabel } from './reason-engine.js';

export function analyze(visits=[],calls=[],taxonomy=[],lang='id'){
  const activeCalls=calls.filter(c=>!c.is_deleted);
  const sc=activeCalls.length;
  const ecCalls=activeCalls.filter(c=>c.result==='EC');
  const neCalls=activeCalls.filter(c=>c.result==='NON_EC');
  const status={MATCH:0,PARTIAL:0,MISMATCH:0,UNCLEAR:0};
  neCalls.forEach(c=>status[c.reason_match_status||'UNCLEAR']=(status[c.reason_match_status||'UNCLEAR']||0)+1);
  const evaluable=status.MATCH+status.PARTIAL+status.MISMATCH;
  const observedCounts={},observedLabels={},sfaCounts={},matrix={},followCounts={},customReasons={};
  neCalls.forEach(c=>{
    const ok=actualReasonKey(c); const ol=observedLabel(c,taxonomy,lang)||ok; observedLabels[ok]=ol;observedCounts[ok]=(observedCounts[ok]||0)+1;
    const sk=c.sfa_reason_code||'unclear';sfaCounts[sk]=(sfaCounts[sk]||0)+1;
    matrix[sk]??={};matrix[sk][ok]=(matrix[sk][ok]||0)+1;
    const fp=c.revisit_plan||'UNKNOWN';followCounts[fp]=(followCounts[fp]||0)+1;
    if(c.observed_reason_code==='other'&&c.custom_real_reason){const n=normalize(c.custom_real_reason);customReasons[n]??={label:c.custom_real_reason.trim(),count:0,cases:[]};customReasons[n].count++;customReasons[n].cases.push(c)}
  });
  const bySfa={};
  for(const code of Object.keys(sfaCounts)){
    const xs=neCalls.filter(c=>(c.sfa_reason_code||'unclear')===code);const s={MATCH:0,PARTIAL:0,MISMATCH:0,UNCLEAR:0};xs.forEach(c=>s[c.reason_match_status||'UNCLEAR']++);const ev=s.MATCH+s.PARTIAL+s.MISMATCH;
    bySfa[code]={n:xs.length,...s,exactRate:pct(s.MATCH,ev),mismatchRate:pct(s.MISMATCH,ev)};
  }
  const visitSummaries=visits.map(v=>{const cs=activeCalls.filter(c=>c.visit_id===v.id);const ec=cs.filter(c=>c.result==='EC').length;return {visit:v,sc:cs.length,ec,ne:cs.length-ec,ecsc:pct(ec,cs.length),revenue:cs.filter(c=>c.result==='EC').reduce((a,c)=>a+num(c.omzet),0)}});
  return {
    sc,ec:ecCalls.length,ne:neCalls.length,ecsc:pct(ecCalls.length,sc),totalRevenue:ecCalls.reduce((a,c)=>a+num(c.omzet),0),avgRevenueEc:ecCalls.length?ecCalls.reduce((a,c)=>a+num(c.omzet),0)/ecCalls.length:0,
    status,exactRate:pct(status.MATCH,evaluable),mismatchRate:pct(status.MISMATCH,evaluable),observedCounts,observedLabels,sfaCounts,matrix,followCounts,customReasons,bySfa,visitSummaries,
    topObserved:Object.entries(observedCounts).sort((a,b)=>b[1]-a[1])[0]||null,
    topMismatch:Object.entries(bySfa).sort((a,b)=>b[1].mismatchRate-a[1].mismatchRate)[0]||null
  };
}

export function buildFindings(a,taxonomy,lang='id'){
  const out=[];
  const t=code=>{const r=taxonomy.find(x=>x.reason_code===code);return r?(lang==='id'?r.reason_label_id:r.reason_label_en):code};
  if(a.ne===0) return out;
  if(a.topMismatch && a.topMismatch[1].n>=3) out.push({title:lang==='id'?'Reason dengan mismatch tertinggi':'Highest mismatch reason',text:`${t(a.topMismatch[0])}: ${a.topMismatch[1].mismatchRate}% mismatch (${a.topMismatch[1].MISMATCH}/${a.topMismatch[1].n} case).`});
  const custom=Object.values(a.customReasons).sort((x,y)=>y.count-x.count);
  if(custom.length) out.push({title:lang==='id'?'Taxonomy gap terdeteksi':'Taxonomy gap detected',text:`${custom.reduce((s,x)=>s+x.count,0)} case menggunakan alasan riil di luar taxonomy existing; ${custom.length} wording unik perlu direview sebelum dirumuskan menjadi reason E-Work baru.`});
  const noFollow=a.followCounts.NONE||0;if(noFollow)out.push({title:lang==='id'?'Non-EC tanpa follow-up plan':'Non-EC without follow-up plan',text:`${noFollow} dari ${a.ne} Non-EC (${pct(noFollow,a.ne)}%) tercatat tanpa rencana follow-up.`});
  return out;
}

export { observedLabel, sfaLabel } from './reason-engine.js';
