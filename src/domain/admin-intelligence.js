import { num, pct } from '../config/utils.js';
import { observedLabel, sfaLabel } from './analysis-engine.js';

const callMethod=c=>c.call_method||'VISIT';
const alive=c=>!c.is_deleted;
const latestRecoveredByCall=attempts=>{
  const map={};
  for(const a of attempts||[]){
    if(a.outcome!=='RECOVERED_EC')continue;
    const prev=map[a.call_id];
    if(!prev||String(a.attempted_at)>String(prev.attempted_at))map[a.call_id]=a;
  }
  return map;
};

export function buildAdminIntelligence({visits=[],calls=[],taxonomy=[],reasonDetails=[],stockItems=[],recoveryAttempts=[],photos=[],minDirectionalSample=5,language='id'}){
  const activeCalls=calls.filter(alive);
  const visitCalls=activeCalls.filter(c=>callMethod(c)==='VISIT');
  const waCalls=activeCalls.filter(c=>callMethod(c)==='WHATSAPP');
  const visitEc=visitCalls.filter(c=>c.result==='EC');
  const nonEc=visitCalls.filter(c=>c.result==='NON_EC');
  const recoveredMap=latestRecoveredByCall(recoveryAttempts);
  const recovered=Object.values(recoveredMap);
  const detailMap=Object.fromEntries((reasonDetails||[]).map(x=>[x.call_id,x]));
  const stockByCall={};for(const x of stockItems||[])(stockByCall[x.call_id]??=[]).push(x);
  const attemptsByCall={};for(const x of recoveryAttempts||[])(attemptsByCall[x.call_id]??=[]).push(x);
  const photosByCall={};for(const x of photos||[])(photosByCall[x.call_id]??=[]).push(x);

  const reasonCounts={};
  for(const c of nonEc){const k=c.observed_reason_code||'unclear';reasonCounts[k]=(reasonCounts[k]||0)+1}
  const biggest=Object.entries(reasonCounts).sort((a,b)=>b[1]-a[1])[0]||null;
  const recoverable=nonEc.filter(c=>detailMap[c.id]?.recoverable_today==='YES');
  const structural=nonEc.filter(c=>detailMap[c.id]?.recoverable_today==='NO');

  const picClosed=nonEc.filter(c=>['pic','closed'].includes(c.observed_reason_code));
  const picClosedRecoverable=picClosed.filter(c=>detailMap[c.id]?.recoverable_today==='YES');
  const picClosedRecovered=picClosed.filter(c=>recoveredMap[c.id]);

  const channels={WA:{attempts:0,recovered:0,revenue:0},PHONE:{attempts:0,recovered:0,revenue:0},REVISIT:{attempts:0,recovered:0,revenue:0},OTHER:{attempts:0,recovered:0,revenue:0}};
  for(const a of recoveryAttempts||[]){const x=channels[a.channel]||channels.OTHER;x.attempts++;if(a.outcome==='RECOVERED_EC'){x.recovered++;x.revenue+=num(a.omzet)}}
  for(const x of Object.values(channels))x.conversion=pct(x.recovered,x.attempts);

  const closedCalls=nonEc.filter(c=>c.observed_reason_code==='closed');
  const closedTypes={};for(const c of closedCalls){const k=detailMap[c.id]?.closed_status||'UNCLASSIFIED';closedTypes[k]=(closedTypes[k]||0)+1}
  const closedRecovered=closedCalls.filter(c=>recoveredMap[c.id]).length;

  const bma=nonEc.filter(c=>c.observed_reason_code==='stock');
  const bombing={YES:0,NO:0,UNKNOWN:0,UNANSWERED:0};
  for(const c of bma){const x=detailMap[c.id]?.salesman_bombing_claim||'UNANSWERED';bombing[x]=(bombing[x]||0)+1}
  const stockProductCounts={};for(const item of stockItems||[]){stockProductCounts[item.product_name]=(stockProductCounts[item.product_name]||0)+1}

  const enough=n=>n>=Number(minDirectionalSample||5);
  const questions=[
    {id:'Q1',title:'Apa issue Non-EC terbesar dan paling bisa diintervensi?',sample:nonEc.length,status:enough(nonEc.length)?'DIRECTIONAL':'INSUFFICIENT',answer:biggest?`${observedLabel({observed_reason_code:biggest[0]},taxonomy,language)} adalah cluster terbesar (${biggest[1]}/${nonEc.length}). ${recoverable.length} Non-EC ditandai masih recoverable hari yang sama; ${structural.length} ditandai tidak recoverable hari itu.`:'Belum ada Non-EC.'},
    {id:'Q2',title:'PIC & Toko Tutup: lost demand atau timing/access issue?',sample:picClosed.length,status:enough(picClosed.length)?'DIRECTIONAL':'INSUFFICIENT',answer:`${picClosed.length} kasus PIC/Toko Tutup; ${picClosedRecoverable.length} ditandai recoverable hari yang sama dan ${picClosedRecovered.length} sudah tercatat recovered EC.`},
    {id:'Q3',title:'WA, Phone, atau Revisit mana yang paling efektif?',sample:(recoveryAttempts||[]).length,status:enough((recoveryAttempts||[]).length)?'DIRECTIONAL':'INSUFFICIENT',answer:Object.entries(channels).map(([k,x])=>`${k}: ${x.recovered}/${x.attempts} recovered (${x.conversion}%)`).join(' · ')||'Belum ada recovery attempt.'},
    {id:'Q4',title:'Toko Tutup mana yang masih bisa order di hari yang sama?',sample:closedCalls.length,status:enough(closedCalls.length)?'DIRECTIONAL':'INSUFFICIENT',answer:`${closedCalls.length} toko tutup; ${closedCalls.filter(c=>detailMap[c.id]?.recoverable_today==='YES').length} ditandai masih punya chance hari itu; ${closedRecovered} sudah recovered EC.`},
    {id:'Q5',title:'BMA: natural order cycle atau indikasi previous order terlalu besar?',sample:bma.length,status:enough(bma.length)?'DIRECTIONAL':'INSUFFICIENT',answer:`${bma.length} kasus BMA. Pengakuan salesman oversized order: Ya ${bombing.YES||0}, Tidak ${bombing.NO||0}, Tidak tahu ${bombing.UNKNOWN||0}, belum diisi ${bombing.UNANSWERED||0}. Validasi bombing tetap membutuhkan DBase history order.`}
  ];

  return {
    visitSc:visitCalls.length,visitEc:visitEc.length,visitNonEc:nonEc.length,visitEcsc:pct(visitEc.length,visitCalls.length),visitRevenue:visitEc.reduce((s,c)=>s+num(c.omzet),0),
    waEc:waCalls.length,waRevenue:waCalls.reduce((s,c)=>s+num(c.omzet),0),recoveredEc:recovered.length,recoveredRevenue:recovered.reduce((s,a)=>s+num(a.omzet),0),
    totalSuccessfulOrders:visitEc.length+waCalls.length+recovered.length,totalRevenue:visitEc.reduce((s,c)=>s+num(c.omzet),0)+waCalls.reduce((s,c)=>s+num(c.omzet),0)+recovered.reduce((s,a)=>s+num(a.omzet),0),
    reasonCounts,biggest,recoverableCount:recoverable.length,structuralCount:structural.length,channels,closedTypes,closedRecovered,bombing,stockProductCounts,questions,
    detailMap,stockByCall,attemptsByCall,photosByCall,recoveredMap
  };
}

export function callAdminRow(call,ctx){
  const v=(ctx.visits||[]).find(x=>x.id===call.visit_id)||{};
  const p=(ctx.profiles||[]).find(x=>x.id===call.jovis_user_id)||{};
  const d=ctx.intel.detailMap[call.id]||{};
  const attempts=ctx.intel.attemptsByCall[call.id]||[];
  const recovered=ctx.intel.recoveredMap[call.id];
  return {
    call,
    visit:v,
    jovis:p.display_name||p.email||'',
    date:v.visit_date||'',depot:v.depot||'',salesman:v.salesman_name||'',outletId:call.outlet_id||'',outletName:call.outlet_name||'',method:call.call_method||'VISIT',route:call.route_status||'',result:call.result||'',omzet:num(call.omzet),actual:call.result==='NON_EC'?observedLabel(call,ctx.taxonomy,ctx.language):'',sfa:call.result==='NON_EC'?sfaLabel(call,ctx.taxonomy,ctx.language):'',recoverable:d.recoverable_today||'',recovery:recovered?'RECOVERED_EC':(attempts.length?attempts.at(-1).outcome:''),duration:call.duration_seconds??'',lat:call.checkin_latitude??'',long:call.checkin_longitude??'',accuracy:call.checkin_accuracy_m??'',evidence:call.evidence||'',photoCount:(ctx.intel.photosByCall[call.id]||[]).length
  };
}
