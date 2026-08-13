import { APP_NAME, APP_VERSION, I18N, DEFAULT_REASONS, FOLLOWUP_OPTIONS, FEATURE_FLAGS } from '../config/app-config.js';
import { isSupabaseConfigured } from '../data/supabase-client.js';
import * as Auth from '../auth/auth-service.js';
import * as Local from '../data/local-db.js';
import * as Cloud from '../data/cloud-repository.js';
import * as Media from '../data/media-service.js';
import { enqueue, syncNow, onSyncStatus, queueDiagnostics, retryItem, retryAllErrors } from '../data/sync-engine.js';
import { analyze, buildFindings, observedLabel, sfaLabel, legacySfaLabel, exactSfaCode, analysisReasonStatus } from '../domain/analysis-engine.js';
import { dbCompatibleMatchStatus, recoverySuggestion, normalizedRecoveryStatus, normalizedCaptureType, safeLegacyExactCode } from '../domain/reason-engine.js';
import { FIELD_META, REASON_DETAIL_SCHEMA, emptyReasonDetail, reasonDetailSchema, optionRows } from '../domain/reason-detail-config.js';
import { buildAdminIntelligence, callAdminRow } from '../domain/admin-intelligence.js';
import { exportDetailedExcel, exportJsonBackup } from '../export/exporter.js';
import { nowISO, today, fmtCurrency, fmtDate, fmtTime, esc, num, pct } from '../config/utils.js';

const root=document.getElementById('root');
const toastEl=document.getElementById('toast');
const uuid=()=>crypto.randomUUID();
const t=k=>I18N[S.lang]?.[k]||I18N.id[k]||k;
const storeCodeDigits=value=>String(value||'').replace(/[^0-9]/g,'');
const canonicalStoreCode=value=>{const digits=storeCodeDigits(value);return digits?`C${digits}`:''};
const durationSeconds=(start,end)=>{const a=Date.parse(start||''),b=Date.parse(end||'');return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,Math.round((b-a)/1000)):null};
const fmtDuration=s=>{if(s===null||s===undefined||!Number.isFinite(Number(s)))return '-';const n=Math.max(0,Number(s)),m=Math.floor(n/60),sec=Math.floor(n%60);return m?`${m}m ${String(sec).padStart(2,'0')}s`:`${sec}s`};

const S={
  session:null,user:null,profile:null,profiles:[],visits:[],calls:[],taxonomy:[],reasonMappings:[],
  reasonDetails:[],stockItems:[],recoveryAttempts:[],photos:[],appSettings:[],
  lang:'id',route:'home',selectedVisitId:null,selectedRecoveryCallId:null,adminSelectedCallId:null,adminDetailMode:'calls',cloudWarnings:[],
  callDraft:null,callDetailDraft:null,stockDraft:[],pendingPhotoIds:[],pendingPhotoMeta:[],callStage:0,editingCallId:null,
  geoBusy:false,geoError:'',sync:{online:navigator.onLine,pending:0,errors:0,syncing:false},queueItems:[],diagnostics:null,
  filters:{date:'',jovis:'',depot:'',salesman:''},
  detailFilters:{date:'',jovis:'',depot:'',salesman:'',outletId:'',outletName:'',method:'',route:'',result:'',omzet:'',actual:'',sfa:'',recovery:'',duration:'',gps:'',evidence:'',photo:''},
  mapFilters:{date:'',jovis:'',salesman:'',result:'',reason:''},
  adminTimer:null,backgroundTimer:null,pulling:false
};

const isAdmin=()=>S.profile?.role==='admin';
const myVisits=()=>S.visits.filter(v=>v.jovis_user_id===S.user?.id&&!v.is_deleted);
const activeVisit=()=>myVisits().find(v=>v.status==='active')||null;
const callMethod=c=>c?.call_method||'VISIT';
const visitCalls=id=>S.calls.filter(c=>c.visit_id===id&&!c.is_deleted).sort((a,b)=>String(a.call_timestamp||'').localeCompare(String(b.call_timestamp||'')));
const profileName=id=>S.profiles.find(p=>p.id===id)?.display_name||S.profiles.find(p=>p.id===id)?.email||id?.slice(0,8)||'-';
const taxonomyLabel=(code,lang=S.lang)=>{const r=S.taxonomy.find(x=>x.reason_code===code);return r?(lang==='id'?r.reason_label_id:r.reason_label_en):code||'-'};
const showToast=msg=>{toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(showToast._t);showToast._t=setTimeout(()=>toastEl.classList.remove('show'),2100)};
const settingValue=(key,fallback)=>S.appSettings.find(x=>x.setting_key===key)?.setting_value||fallback;
const photoConfig=()=>settingValue('photo_config',{maxDimension:1280,quality:0.78,maxPhotosPerCall:3});
const analysisRules=()=>settingValue('analysis_rules',{minDirectionalSample:5});
const reasonDetailFor=callId=>S.reasonDetails.find(x=>x.call_id===callId)||null;
const stockItemsFor=callId=>S.stockItems.filter(x=>x.call_id===callId);
const recoveryAttemptsFor=callId=>S.recoveryAttempts.filter(x=>x.call_id===callId).sort((a,b)=>String(a.attempted_at).localeCompare(String(b.attempted_at)));
const photosFor=callId=>S.photos.filter(x=>x.call_id===callId);

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
onSyncStatus(s=>{S.sync=s;renderTopbar()});

async function boot(){
  S.lang=await Local.getSetting('language','id');
  if(!isSupabaseConfigured()){renderConnectionRequired();return}
  try{S.session=await Auth.currentSession();S.user=S.session?.user||null}catch(e){renderError(e);return}
  if(!S.user){renderLogin();return}
  await afterLogin();
}

async function afterLogin(){
  try{
    S.profile=await Auth.loadProfile(S.user.id);
    if(!S.profile){renderProfileMissing();return}
    if(!S.profile.active){renderInactive();return}
    await refreshData({quiet:true});
    route(isAdmin()?'admin-summary':'home');
    startBackgroundPull();
  }catch(e){renderError(e)}
}

async function reconcileQueueWithTombstones(data){
  const tombstoneVisits=new Set((data.visits||[]).filter(v=>v.is_deleted).map(v=>v.id));
  const tombstoneCalls=new Set((data.calls||[]).filter(c=>c.is_deleted).map(c=>c.id));
  const queue=await Local.all('queue');
  for(const item of queue){
    const pid=item.payload?.call_id;
    const staleVisit=item.entity==='visit'&&tombstoneVisits.has(item.payload?.id)&&item.payload?.is_deleted!==true;
    const staleCall=item.entity==='call'&&tombstoneCalls.has(item.payload?.id)&&item.payload?.is_deleted!==true;
    const staleChild=pid&&tombstoneCalls.has(pid);
    if(staleVisit||staleCall||staleChild)await Local.del('queue',item.id);
  }
}

async function reconcileDeletedLocalState(){
  const deletedVisitIds=new Set(S.visits.filter(v=>v.is_deleted).map(v=>v.id));
  for(const visitId of deletedVisitIds)await Local.del('drafts',`call:${visitId}`);
  if(S.callDraft?.visit_id&&deletedVisitIds.has(S.callDraft.visit_id))clearCallState();
  if(S.selectedVisitId&&deletedVisitIds.has(S.selectedVisitId))S.selectedVisitId=null;
}

async function refreshData({quiet=false}={}){
  if(S.pulling)return;S.pulling=true;
  try{
    if(navigator.onLine){
      await syncNow();
      try{
        const data=await Cloud.fetchDataset();
        S.cloudWarnings=data.warnings||[];
        await reconcileQueueWithTombstones(data);
        const pending=await Local.all('queue');
        const pendingVisit=new Set(pending.filter(q=>q.entity==='visit').map(q=>q.payload?.id));
        const pendingCall=new Set(pending.filter(q=>q.entity==='call').map(q=>q.payload?.id));
        // Preserve unsynced local child state during inbound refresh. This prevents a
        // stale cloud row from overwriting a richer offline edit or re-creating a
        // locally deleted stock item before its queued DELETE reaches Supabase.
        const pendingReasonCall=new Set(pending.filter(q=>q.entity==='reasonDetail').map(q=>q.payload?.call_id));
        const pendingStockId=new Set(pending.filter(q=>q.entity==='stockItem').map(q=>q.payload?.id));
        const pendingRecoveryId=new Set(pending.filter(q=>q.entity==='recoveryAttempt').map(q=>q.payload?.id));
        const pendingPhotoId=new Set(pending.filter(q=>q.entity==='photo').map(q=>q.payload?.id));
        await Local.cacheDataset({
          profiles:data.profiles,
          visits:data.visits.filter(v=>v.is_deleted||!pendingVisit.has(v.id)),
          calls:data.calls.filter(c=>c.is_deleted||!pendingCall.has(c.id)),
          taxonomy:data.taxonomy,
          reasonDetails:data.reasonDetails.filter(x=>!pendingReasonCall.has(x.call_id)),
          stockItems:data.stockItems.filter(x=>!pendingStockId.has(x.id)),
          recoveryAttempts:data.recoveryAttempts.filter(x=>!pendingRecoveryId.has(x.id)),
          photos:data.photos.filter(x=>!pendingPhotoId.has(x.id)),
          appSettings:data.appSettings
        });
        S.reasonMappings=data.reasonMappings||[];
      }catch(e){if(!quiet)showToast(`Cloud refresh: ${e.message}`)}
    }
    [S.profiles,S.visits,S.calls,S.taxonomy,S.reasonDetails,S.stockItems,S.recoveryAttempts,S.photos,S.appSettings]=await Promise.all([
      Local.all('profiles'),Local.all('visits'),Local.all('calls'),Local.all('taxonomy'),Local.all('reasonDetails'),Local.all('stockItems'),Local.all('recoveryAttempts'),Local.all('photos'),Local.all('appSettings')
    ]);
    await reconcileDeletedLocalState();
    if(!S.taxonomy.length)S.taxonomy=DEFAULT_REASONS.map((r,i)=>({reason_code:r.code,reason_label_id:r.id,reason_label_en:r.en,reason_type:r.type,active:true,sort_order:r.sort||i+1}));
    S.profile=S.profiles.find(p=>p.id===S.user.id)||S.profile;
    if(!quiet)render();
  }finally{S.pulling=false}
}

function safeToBackgroundPull(){return !!S.user&&navigator.onLine&&!['field','setup','admin-call-edit'].includes(S.route)&&!S.pulling}
function startBackgroundPull(){
  if(S.backgroundTimer)clearInterval(S.backgroundTimer);
  S.backgroundTimer=setInterval(()=>{if(safeToBackgroundPull())refreshData({quiet:false}).catch(()=>{})},Math.max(15,FEATURE_FLAGS.backgroundPullSeconds||60)*1000);
}

function shell(content,{nav=true}={}){
  const roleClass=isAdmin()?'role-admin':'role-jovis',roleLabel=isAdmin()?'Admin Intelligence':'EC/SC 90%',userLabel=S.profile?.display_name||S.profile?.email||S.user?.email||'';
  return `<div class="app ${roleClass}"><header class="topbar"><img class="logo" src="assets/nabati-logo.png" alt="Nabati"><div class="brand"><b>${APP_NAME}</b><small>${roleLabel} · v${APP_VERSION}</small></div><div class="spacer"></div>${userLabel?`<span class="topbar-user">${esc(userLabel)}</span>`:''}<span id="syncBadge">${syncBadge()}</span><button class="btn btn-secondary lang-btn" data-action="lang">${S.lang==='id'?'EN':'ID'}</button></header><main>${content}</main>${nav?bottomNav():''}</div>`;
}

function syncBadge(){const cls=S.sync.syncing?'blue':!S.sync.online?'warn':S.sync.errors?'bad':S.sync.pending?'warn':'good';const label=S.sync.syncing?t('syncing'):!S.sync.online?`${t('offline')} · ${S.sync.pending}`:S.sync.errors?`${t('syncError')} · ${S.sync.errors}`:S.sync.pending?`${S.sync.pending} ${t('pending')}`:t('synced');return `<button type="button" class="pill ${cls} sync-badge-btn" data-action="openDiagnostics"><i class="sync-dot"></i>${label}</button>`}
function renderTopbar(){const el=document.getElementById('syncBadge');if(el)el.innerHTML=syncBadge()}
function navIcon(name){
  const icons={
    home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9 20v-6h6v6"/>',
    field:'<path d="M12 5v14M5 12h14"/>',
    analysis:'<path d="M5 19V9M12 19V5M19 19v-7"/>',
    summary:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    detail:'<path d="M5 6h14M5 12h14M5 18h14"/><circle cx="3" cy="6" r=".5"/><circle cx="3" cy="12" r=".5"/><circle cx="3" cy="18" r=".5"/>',
    map:'<path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2Z"/><path d="M9 4v14M15 6v14"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5L9.2 6a7 7 0 0 0-1.7 1L5.1 6 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5.1 18l2.4-1a7 7 0 0 0 1.7 1l.3 3h5l.3-3a7 7 0 0 0 1.7-1l2.4 1 2.1-3.5-2.1-1.5a7 7 0 0 0 .1-1Z"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||'<circle cx="12" cy="12" r="2"/>'}</svg>`;
}

function bottomNav(){
  const items=isAdmin()?[
    ['admin-summary','summary','Summary'],['admin-detail','detail','Detail'],['admin-map','map','Map'],['admin-analysis','analysis','Analisis'],['settings','settings','Pengaturan']
  ]:[['home','home',t('home')],['field','field',t('field')],['analysis','analysis',t('analysis')],['settings','settings',t('settings')]];
  return `<nav class="bottom-nav" style="--nav-count:${items.length}">${items.map(([r,i,l])=>`<button class="nav ${S.route===r?'active':''}" data-route="${r}"><span class="nav-icon">${navIcon(i)}</span><span class="nav-label">${l}</span></button>`).join('')}</nav>`;
}
function route(r,payload={}){
  if(S.adminTimer){clearInterval(S.adminTimer);S.adminTimer=null}
  S.route=r;if(payload.visitId)S.selectedVisitId=payload.visitId;if(payload.callId)S.adminSelectedCallId=payload.callId;
  if(r==='field'&&!S.callDraft)resetCallDraft();render();
  if(r==='settings')loadDiagnosticsData().then(()=>{if(S.route==='settings')render()}).catch(()=>{});
}
function render(){
  if(!S.user){renderLogin();return}
  let content='';
  if(S.route==='home')content=isAdmin()?renderAdminSummary():renderHome();
  else if(S.route==='setup')content=renderVisitSetup();
  else if(S.route==='field')content=renderField();
  else if(S.route==='recovery')content=renderRecovery();
  else if(S.route==='analysis')content=renderAnalysis();
  else if(S.route==='admin-summary')content=renderAdminSummary();
  else if(S.route==='admin-detail')content=renderAdminDetail();
  else if(S.route==='admin-map')content=renderAdminMap();
  else if(S.route==='admin-analysis')content=renderAdminAnalysis();
  else if(S.route==='admin-call-edit')content=renderAdminCallEdit();
  else if(S.route==='settings')content=renderSettings();
  root.innerHTML=shell(content,{nav:!['admin-call-edit'].includes(S.route)});
  if(S.route==='admin-map')setTimeout(initAdminMap,0);
}

function renderConnectionRequired(){root.innerHTML=`<div class="login-shell"><div class="card login-card"><h1>${APP_NAME}</h1><div class="notice bad">${t('connectRequired')}</div><p class="muted">${t('connectHelp')}</p></div></div>`}
function renderLogin(){root.innerHTML=`<div class="login-shell"><form id="loginForm" class="card login-card"><div class="login-brand"><img class="login-logo" src="assets/nabati-logo.png"><h1>${APP_NAME}</h1><p>EC/SC 90% · Non-EC Validation</p></div><h1>${t('login')}</h1><div class="field"><label>${t('email')}</label><input class="input" name="email" type="email" autocomplete="username" required></div><div class="field"><label>${t('password')}</label><input class="input" name="password" type="password" autocomplete="current-password" required></div><button class="btn btn-primary btn-block">${t('login')}</button><div id="loginError" class="notice bad hidden" style="margin-top:10px"></div></form></div>`}
function renderProfileMissing(){root.innerHTML=shell(`<div class="card"><h1>Profile belum tersedia</h1><button class="btn btn-danger" data-action="logout">${t('logout')}</button></div>`,{nav:false})}
function renderInactive(){root.innerHTML=shell(`<div class="card"><h1>Akun nonaktif</h1><button class="btn btn-danger" data-action="logout">${t('logout')}</button></div>`,{nav:false})}
function renderError(e){root.innerHTML=`<div class="login-shell"><div class="card login-card"><h1>Application Error</h1><div class="notice bad">${esc(e?.message||String(e))}</div><button class="btn btn-secondary btn-block" onclick="location.reload()" style="margin-top:10px">Reload</button></div></div>`}

function visitStats(v){const cs=visitCalls(v.id),physical=cs.filter(c=>callMethod(c)==='VISIT'),ec=physical.filter(c=>c.result==='EC'),wa=cs.filter(c=>callMethod(c)==='WHATSAPP');return{sc:physical.length,ec:ec.length,ne:physical.length-ec.length,ecsc:pct(ec.length,physical.length),revenue:ec.reduce((s,c)=>s+num(c.omzet),0),wa:wa.length,waRevenue:wa.reduce((s,c)=>s+num(c.omzet),0)}}
function dwellStats(calls){const physical=calls.filter(c=>callMethod(c)==='VISIT'),valid=physical.map(c=>Number(c.duration_seconds)).filter(x=>Number.isFinite(x)&&x>=0),ec=physical.filter(c=>c.result==='EC').map(c=>Number(c.duration_seconds)).filter(Number.isFinite),ne=physical.filter(c=>c.result==='NON_EC').map(c=>Number(c.duration_seconds)).filter(Number.isFinite),avg=a=>a.length?Math.round(a.reduce((s,x)=>s+x,0)/a.length):null;return{n:valid.length,avg:avg(valid),avgEc:avg(ec),avgNonEc:avg(ne)}}

function pendingRecoveryCalls(){
  const todayStr=today();const callMap=new Set(S.recoveryAttempts.filter(a=>a.outcome==='RECOVERED_EC').map(a=>a.call_id));
  return S.calls.filter(c=>!c.is_deleted&&c.jovis_user_id===S.user.id&&callMethod(c)==='VISIT'&&c.result==='NON_EC'&&!callMap.has(c.id)).filter(c=>{
    const v=S.visits.find(x=>x.id===c.visit_id);const d=reasonDetailFor(c.id);return v?.visit_date===todayStr&&d?.recoverable_today==='YES';
  });
}
function renderHome(){
  const av=activeVisit(),vis=[...myVisits()].sort((a,b)=>String(b.start_time).localeCompare(String(a.start_time))).slice(0,8),pending=pendingRecoveryCalls(),z=av?visitStats(av):null;
  const activeBlock=av?`<div class="jovis-active-card"><div class="section-head"><div><span class="eyebrow">ACTIVE VISIT</span><h1>${esc(av.depot)} · ${esc(av.salesman_name)}</h1><div class="meta">${fmtDate(av.visit_date)} · mulai ${fmtTime(av.start_time)}</div></div><span class="pill blue">Aktif</span></div><div class="jovis-kpi-strip"><div><b>${z.sc}</b><span>Visit SC</span></div><div><b>${z.ec}</b><span>EC</span></div><div><b>${z.ecsc}%</b><span>EC/SC</span></div><div><b>${z.wa}</b><span>WA</span></div></div><button class="btn btn-primary btn-block primary-xl" data-route="field">Lanjutkan Visit</button></div>`:`<div class="jovis-active-card empty-active"><span class="eyebrow">FIELD VISIT</span><h1>Siap mulai join visit?</h1><p class="muted">VISIT memakai GPS. Pure order WhatsApp dicatat sebagai BY WA.</p><button class="btn btn-primary btn-block primary-xl" data-route="setup">+ ${t('startVisit')}</button></div>`;
  return `${activeBlock}${pending.length?`<div class="card jovis-section"><div class="section-head"><div><h2>Recovery Pending</h2><div class="meta">Non-EC hari ini yang masih punya peluang order</div></div><span class="pill warn">${pending.length}</span></div><div class="compact-list">${pending.map(c=>`<div class="compact-row"><div><b>${esc(c.outlet_id||'')} · ${esc(c.outlet_name)}</b><div class="meta">${esc(observedLabel(c,S.taxonomy,S.lang))} · ${fmtTime(c.checkin_at||c.call_timestamp)}</div></div><button class="btn btn-soft compact-action" data-recovery-call="${c.id}">Recovery</button></div>`).join('')}</div></div>`:''}<div class="card jovis-section"><div class="section-head"><div><h2>Visit Saya</h2><div class="meta">Riwayat join visit terbaru</div></div><span class="pill">${vis.length}</span></div>${vis.length?`<div class="list visit-list">${vis.map(visitCard).join('')}</div>`:`<div class="empty">${t('noData')}</div>`}</div>`;
}

function visitCard(v){const z=visitStats(v);return `<div class="list-card visit-card"><div class="list-top"><div><div class="list-title">${esc(v.depot)} · ${esc(v.salesman_name)}</div><div class="meta">${fmtDate(v.visit_date)} · ${fmtTime(v.start_time)}</div></div><span class="pill ${v.status==='active'?'blue':'good'}">${v.status==='active'?t('active'):t('completed')}</span></div><div class="metrics visit-metrics"><span class="metric">SC ${z.sc}</span><span class="metric">EC ${z.ec}</span><span class="metric">EC/SC ${z.ecsc}%</span><span class="metric">WA ${z.wa}</span></div><div class="visit-card-actions"><button class="btn btn-secondary" data-open-visit="${v.id}">Analisis</button><button class="btn btn-ghost" data-edit-visit="${v.id}">Edit</button></div></div>`}

function renderVisitSetup(editId=null){
  if(isAdmin())return `<div class="card"><h1>Admin tidak memiliki workflow Visit.</h1></div>`;
  const v=editId?S.visits.find(x=>x.id===editId):null;
  return `<div class="card"><h1>${v?'Edit Visit':t('startVisit')}</h1><form id="visitForm" data-edit-id="${v?.id||''}"><div class="grid2"><div class="field"><label>${t('date')}</label><input class="input" type="date" name="visit_date" value="${v?.visit_date||today()}" required></div><div class="field"><label>${t('depot')}</label><input class="input" name="depot" value="${esc(v?.depot||'')}" required></div><div class="field"><label>${t('salesman')}</label><input class="input" name="salesman_name" value="${esc(v?.salesman_name||'')}" required></div><div class="field"><label>${t('salesmanId')}</label><input class="input" name="salesman_id" value="${esc(v?.salesman_id||'')}"></div></div><div class="field"><label>${t('notes')}</label><textarea class="textarea" name="notes">${esc(v?.notes||'')}</textarea></div><button class="btn btn-primary btn-block">${v?'Simpan Perubahan':t('startVisit')}</button></form></div>`;
}

function newCallDraft(){return {id:uuid(),visit_id:activeVisit()?.id||S.selectedVisitId||null,jovis_user_id:S.user.id,call_method:null,outlet_id:'',outlet_name:'',route_status:'JKS',result:null,call_timestamp:null,checkin_at:null,checkout_at:null,checkin_latitude:null,checkin_longitude:null,checkin_accuracy_m:null,checkout_latitude:null,checkout_longitude:null,checkout_accuracy_m:null,duration_seconds:null,omzet:null,observed_reason_code:null,custom_real_reason:'',contributing_factor:null,evidence:'',sfa_reason_code:null,sfa_reason_exact_code:null,sfa_capture_type:'EXACT',sfa_recovery_status:null,reason_match_status:null,sfa_selection_reason:'',revisit_plan:null,can_revisit_earlier:null,followup_timing_reason:'',quick_note:'',client_created_at:nowISO(),client_updated_at:nowISO(),is_deleted:false}}
function clearCallState(){S.callDraft=null;S.callDetailDraft=null;S.stockDraft=[];S.pendingPhotoIds=[];S.pendingPhotoMeta=[];S.callStage=0;S.editingCallId=null;S.geoError='';S.geoBusy=false}
function resetCallDraft(){S.callDraft=newCallDraft();S.callDetailDraft=emptyReasonDetail(S.callDraft.id,S.user.id);S.stockDraft=[];S.pendingPhotoIds=[];S.pendingPhotoMeta=[];S.callStage=0;S.editingCallId=null;S.geoError='';S.geoBusy=false;saveDraftLocal()}
async function saveDraftLocal(){const v=activeVisit()||S.visits.find(x=>x.id===S.callDraft?.visit_id);if(!v||!S.callDraft)return;await Local.put('drafts',{id:`call:${v.id}`,visit_id:v.id,call:S.callDraft,detail:S.callDetailDraft,stock:S.stockDraft,pendingPhotoIds:S.pendingPhotoIds,stage:S.callStage,editingCallId:S.editingCallId,saved_at:nowISO()})}
async function restoreDraft(v){const d=await Local.get('drafts',`call:${v.id}`);if(d){S.callDraft=d.call;S.callDraft.call_method=S.callDraft.call_method||null;S.callDetailDraft=d.detail||emptyReasonDetail(S.callDraft.id,S.user.id);S.stockDraft=d.stock||[];S.pendingPhotoIds=d.pendingPhotoIds||[];S.pendingPhotoMeta=await Media.pendingPhotoRows(S.pendingPhotoIds);S.callStage=d.stage||0;S.editingCallId=d.editingCallId||null;S.geoError='';S.geoBusy=false}else resetCallDraft()}

function geoErrorMessage(err){if(err?.code===1)return'Permission lokasi wajib diaktifkan untuk melakukan check-in call.';if(err?.code===2)return'Lokasi perangkat tidak dapat ditentukan. Pastikan GPS aktif.';if(err?.code===3)return'Pengambilan lokasi timeout. Coba lagi.';return'Browser tidak dapat mengambil lokasi.'}
function getRequiredPosition(){return new Promise((resolve,reject)=>{if(!navigator.geolocation){reject(Object.assign(new Error('Geolocation unavailable'),{code:0}));return}navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:20000,maximumAge:0})})}
async function checkInCurrentCall(){if(S.editingCallId)return;const d=S.callDraft||newCallDraft();if(d.checkin_at)return;S.geoBusy=true;S.geoError='';render();try{const requestedAt=nowISO(),pos=await getRequiredPosition();d.checkin_at=requestedAt;d.call_timestamp=requestedAt;d.checkin_latitude=pos.coords.latitude;d.checkin_longitude=pos.coords.longitude;d.checkin_accuracy_m=pos.coords.accuracy;d.client_updated_at=nowISO();S.callDraft=d;await saveDraftLocal();S.geoBusy=false;render();showToast(`Check-in berhasil · GPS ±${Math.round(pos.coords.accuracy)} m`)}catch(err){S.geoBusy=false;S.geoError=geoErrorMessage(err);render()}}
async function captureCheckoutLocation(){S.geoBusy=true;S.geoError='';render();try{const requestedAt=nowISO(),pos=await getRequiredPosition(),d=S.callDraft;d.checkout_at=requestedAt;d.checkout_latitude=pos.coords.latitude;d.checkout_longitude=pos.coords.longitude;d.checkout_accuracy_m=pos.coords.accuracy;d.duration_seconds=durationSeconds(d.checkin_at,d.checkout_at);d.client_updated_at=nowISO();S.geoBusy=false;return true}catch(err){S.geoBusy=false;S.geoError=geoErrorMessage(err);render();return false}}

function renderField(){
  if(isAdmin())return `<div class="card"><h1>Admin tidak memiliki menu Visit.</h1><button class="btn btn-secondary" data-route="admin-detail">Kembali ke Detail</button></div>`;
  const v=activeVisit()||S.visits.find(x=>x.id===S.callDraft?.visit_id&&!x.is_deleted);if(!v)return `<div class="card"><h1>${t('field')}</h1><button class="btn btn-primary" data-route="setup">${t('startVisit')}</button></div>`;
  if(!S.callDraft)resetCallDraft();const cs=visitCalls(v.id),z=visitStats(v),seqById=new Map(cs.map((c,i)=>[c.id,i+1]));
  let body='';
  if(!S.callDraft.call_method&&!S.editingCallId)body=renderCallMethodGate(cs.length+1);
  else if(callMethod(S.callDraft)==='WHATSAPP')body=renderWhatsappCall();
  else if(!S.callDraft.checkin_at&&!S.editingCallId)body=renderCheckinGate(cs.filter(c=>callMethod(c)==='VISIT').length+1);
  else body=renderCallStage();
  const history=cs.slice().reverse().map(c=>{const seq=seqById.get(c.id)||0,method=callMethod(c);return `<div class="reason-card"><div class="list-top"><div><div class="call-history-title"><span class="pill blue">CALL #${String(seq).padStart(2,'0')}</span><span class="pill ${method==='WHATSAPP'?'good':'blue'}">${method==='WHATSAPP'?'BY WA':'VISIT'}</span></div><b>${esc(c.outlet_id||'')} · ${esc(c.outlet_name)}</b><div class="meta">${method==='WHATSAPP'?'Pure WhatsApp':fmtTime(c.checkin_at||c.call_timestamp)} · ${c.result}${c.result==='EC'?` · ${fmtCurrency(c.omzet)}`:` · ${esc(observedLabel(c,S.taxonomy,S.lang))}`}</div></div><button class="btn btn-secondary" data-edit-call="${c.id}" data-visit-id="${v.id}">Edit</button></div>${c.result==='NON_EC'?`<button class="btn btn-soft" style="margin-top:7px" data-recovery-call="${c.id}">+ Update Recovery</button>`:''}</div>`}).join('');
  return `<div class="two-col field-workspace"><section><div class="card call-composer"><div class="call-header"><div class="num">${S.editingCallId?'✎':cs.length+1}</div><div class="info"><h2 style="margin:0">${esc(v.depot)} · ${esc(v.salesman_name)}</h2><div class="meta">Visit SC ${z.sc} · EC ${z.ec} · EC/SC ${z.ecsc}% · WA ${z.wa}</div></div></div>${body}</div></section><aside><div class="card call-history-card"><div class="section-head"><div><h2>History Call</h2><div class="meta">Semua call · terbaru di atas</div></div><span class="pill blue">${cs.length}</span></div><div class="call-history-scroll">${history||`<div class="empty">${t('noData')}</div>`}</div><hr><button class="btn btn-danger btn-block" data-action="endVisit">${t('endVisit')}</button></div></aside></div>`;
}
function renderCallMethodGate(callNo){return `<div class="method-gate"><span class="pill blue">CALL #${callNo}</span><h2 style="margin-top:12px">Metode call?</h2><p class="muted small">Utamakan VISIT. BY WA hanya untuk EC yang benar-benar didapat tanpa kunjungan fisik.</p><button class="method-primary" data-call-method="VISIT"><b>📍 VISIT</b><span>Physical visit · GPS wajib</span></button><button class="method-secondary" data-call-method="WHATSAPP"><b>💬 BY WA</b><span>Pure order WhatsApp · tanpa visit</span></button></div>`}
function renderCheckinGate(callNo){return `<div class="checkin-gate"><span class="pill blue">VISIT CALL #${callNo}</span><div class="checkin-number">#${callNo}</div><h2>Check-in sebelum mulai input</h2><p class="muted small">Form call terkunci sampai timestamp dan GPS check-in berhasil.</p>${S.geoError?`<div class="notice bad" style="margin-bottom:10px">${esc(S.geoError)}</div>`:''}<button class="btn btn-primary btn-block" data-action="checkInCall" ${S.geoBusy?'disabled':''}>${S.geoBusy?'Mengambil Lokasi...':`CHECK IN CALL #${callNo}`}</button><button class="btn btn-secondary btn-block" style="margin-top:8px" data-action="resetCallMethod">← Ubah metode</button></div>`}
function renderWhatsappCall(){const d=S.callDraft,code=storeCodeDigits(d.outlet_id);return `<div class="notice good"><b>BY WA</b> · Pure EC tanpa physical visit. Tidak masuk denominator Visit EC/SC.</div><div class="field" style="margin-top:12px"><label>Kode Toko</label><div class="store-code-wrap"><span class="store-code-prefix">C</span><input id="outletCodeDigits" class="input store-code-input" inputmode="numeric" value="${esc(code)}"></div></div><div class="field"><label>Nama Toko</label><input id="outletName" class="input" value="${esc(d.outlet_name)}"></div><div class="field"><label>Omzet EC (Rp) *</label><input id="omzet" class="input" type="number" inputmode="numeric" min="0" value="${d.omzet??''}"></div><div class="field"><label>Quick Note</label><textarea id="quickNote" class="textarea">${esc(d.quick_note||'')}</textarea></div><div class="btn-row"><button class="btn btn-secondary" data-action="resetCallMethod">← Metode</button><button class="btn btn-primary" data-action="saveWhatsapp">Simpan BY WA EC</button></div>`}
function reasonChips(selected,attr,type='observed'){return S.taxonomy.filter(r=>r.active&&(r.reason_type==='both'||r.reason_type===type)).map(r=>`<button type="button" class="chip ${selected===r.reason_code?'selected':''}" data-${attr}="${r.reason_code}">${esc(S.lang==='id'?r.reason_label_id:r.reason_label_en)}</button>`).join('')}
function renderReasonDetailField(field){const meta=FIELD_META[field]||{label:field,type:'text'},val=S.callDetailDraft?.[field]??'';if(meta.type==='select')return `<div class="field"><label>${esc(meta.label)}</label><select class="select" data-rd-field="${field}"><option value="">-</option>${optionRows(field).map(([k,l])=>`<option value="${k}" ${val===k?'selected':''}>${esc(l)}</option>`).join('')}</select></div>`;if(meta.type==='textarea')return `<div class="field"><label>${esc(meta.label)}</label><textarea class="textarea" data-rd-field="${field}">${esc(val)}</textarea></div>`;return `<div class="field"><label>${esc(meta.label)}</label><input class="input" type="${meta.type||'text'}" data-rd-field="${field}" value="${esc(val||'')}" placeholder="${esc(meta.placeholder||'')}"></div>`}
function renderStockItems(){return `<div class="reason-subcard"><div class="section-head"><div><h3>Barang/SKU yang masih ada</h3><div class="meta">Capture pengakuan/observasi dulu; validasi bombing nanti dari DBase history order.</div></div><button class="btn btn-secondary" data-action="addStockItem">+ SKU</button></div>${S.stockDraft.length?S.stockDraft.map((x,i)=>`<div class="stock-row"><input class="input" data-stock-index="${i}" data-stock-field="product_name" value="${esc(x.product_name||'')}" placeholder="Nama produk/SKU"><select class="select" data-stock-index="${i}" data-stock-field="stock_level"><option value="">Kondisi stok</option>${[['LOT','Banyak/menumpuk'],['MEDIUM','Sedang'],['LOW','Sedikit'],['OUT','Habis'],['UNKNOWN','Tidak tahu']].map(([k,l])=>`<option value="${k}" ${x.stock_level===k?'selected':''}>${l}</option>`).join('')}</select><input class="input" data-stock-index="${i}" data-stock-field="qty_note" value="${esc(x.qty_note||'')}" placeholder="Qty/keterangan"><button class="btn btn-danger" data-remove-stock="${i}">×</button></div>`).join(''):`<div class="empty small">Belum ada SKU. Tambahkan minimal satu barang untuk BMA.</div>`}</div>`}
function renderPhotoCapture(schema){const cfg=photoConfig(),existing=S.pendingPhotoMeta.length,synced=S.callDraft?.id?photosFor(S.callDraft.id).length:0;if(isAdmin())return `<div class="reason-subcard"><h3>Foto Evidence</h3><div class="meta">Admin dapat melihat evidence dari Detail/Map. Upload foto dilakukan oleh JOVIS saat capture lapangan.</div>${synced?`<span class="pill blue">${synced} foto tersinkron</span>`:''}</div>`;return `<div class="reason-subcard"><div class="section-head"><div><h3>Foto Evidence ${schema.photoRecommended?'(recommended)':'(optional)'}</h3><div class="meta">Foto dikompresi di HP sebelum upload. Max ${cfg.maxPhotosPerCall||3} foto/call.</div></div><span class="pill blue">${existing}/${cfg.maxPhotosPerCall||3}</span></div><input id="photoInput" class="input" type="file" accept="image/*" capture="environment" multiple ${existing>=(cfg.maxPhotosPerCall||3)?'disabled':''}>${existing?`<div class="photo-list">${S.pendingPhotoMeta.map(p=>`<span class="metric">${esc(p.photo_type)} · ${Math.round((p.size_bytes||0)/1024)} KB</span>`).join('')}</div>`:''}</div>`}
function renderReasonDetails(){const code=S.callDraft?.observed_reason_code;if(!code)return'';const schema=reasonDetailSchema(code);return `<div class="reason-detail-card"><h3>${esc(schema.title)}</h3>${schema.fields.map(renderReasonDetailField).join('')}${schema.stockItems?renderStockItems():''}${renderPhotoCapture(schema)}</div>`}

function callStageProgress(){
  const step=S.callStage===0?1:S.callStage===1?2:3;
  return `<div class="call-stepper"><span class="${step>=1?'active':''}"><b>1</b> Hasil</span><i></i><span class="${step>=2?'active':''}"><b>2</b> Alasan Riil</span><i></i><span class="${step>=3?'active':''}"><b>3</b> E-Work</span></div>`;
}
function renderCallStage(){
  const d=S.callDraft,codeDigits=storeCodeDigits(d.outlet_id),stepper=d.result==='NON_EC'||S.callStage>0?callStageProgress():'',checkinInfo=d.checkin_at?`<div class="notice good" style="margin-bottom:12px"><b>VISIT Checked-in</b> · ${fmtTime(d.checkin_at)} · GPS ±${Math.round(d.checkin_accuracy_m||0)} m${d.duration_seconds!=null?` · ${fmtDuration(d.duration_seconds)}`:''}</div>`:'';
  if(S.callStage===0)return `${stepper}${checkinInfo}<div class="field"><label>${t('outlet')}</label><input id="outletName" class="input" value="${esc(d.outlet_name)}"></div><div class="grid2"><div class="field"><label>${t('outletId')}</label><div class="store-code-wrap"><span class="store-code-prefix">C</span><input id="outletCodeDigits" class="input store-code-input" inputmode="numeric" value="${esc(codeDigits)}"></div></div><div class="field"><label>${t('route')}</label><div class="btn-row"><button class="btn ${d.route_status==='JKS'?'btn-primary':'btn-secondary'}" data-route-status="JKS">JKS</button><button class="btn ${d.route_status==='OFF_ROUTE'?'btn-primary':'btn-secondary'}" data-route-status="OFF_ROUTE">OFF ROUTE</button></div></div></div><div class="field"><label>${t('result')}</label><div class="result-grid"><button class="result-btn ec ${d.result==='EC'?'selected':''}" data-result="EC">EC</button><button class="result-btn ne ${d.result==='NON_EC'?'selected':''}" data-result="NON_EC">NON-EC</button></div></div>${d.result==='EC'?`<div class="field"><label>${t('omzet')} *</label><input id="omzet" class="input" type="number" inputmode="numeric" min="0" value="${d.omzet??''}"></div><button class="btn btn-primary btn-block" data-action="saveEc" ${S.geoBusy?'disabled':''}>${S.editingCallId?'Update EC':'Simpan & Call Berikutnya'}</button>`:''}${d.result==='NON_EC'?`<button class="btn btn-primary btn-block" data-action="nextActual">Lanjut: Alasan Riil</button>`:''}`;
  if(S.callStage===1)return `${stepper}${checkinInfo}<span class="pill blue">Actual Reason</span><h2 style="margin-top:10px">Apa alasan riil toko tidak EC?</h2><p class="muted small">Capture kondisi aktual sebelum melihat reason salesman di SFA/E-Work.</p><div class="chips">${reasonChips(d.observed_reason_code,'observed','observed')}</div>${d.observed_reason_code==='other'?`<div class="field" style="margin-top:12px"><label>${t('customReason')} *</label><input id="customReason" class="input" value="${esc(d.custom_real_reason)}"></div>`:''}<div class="field" style="margin-top:12px"><label>${t('evidence')}</label><textarea id="evidence" class="textarea" placeholder="Fakta/ucapan yang diamati">${esc(d.evidence)}</textarea></div>${renderReasonDetails()}<div class="btn-row"><button class="btn btn-secondary" data-action="prevStage">←</button><button class="btn btn-primary" data-action="nextSfa">Lanjut ke SFA</button></div>`;
  const exact=exactSfaCode(d)||safeLegacyExactCode(d),align=exact?analysisReasonStatus({...d,sfa_reason_exact_code:exact}):'UNRESOLVED',alignClass=align==='MATCH'?'good':align==='MISMATCH'?'bad':'warn';
  return `${stepper}${checkinInfo}<span class="pill blue">Reason SFA/E-Work</span><h2 style="margin-top:10px">Reason apa yang dipilih salesman di SFA?</h2><div class="chips">${reasonChips(exact,'sfa','sfa')}</div>${exact?`<div class="notice ${alignClass}" style="margin-top:12px"><b>${align}</b> · ${esc(observedLabel(d,S.taxonomy,S.lang))} → ${esc(sfaLabel({...d,sfa_reason_exact_code:exact},S.taxonomy,S.lang))}</div>`:''}<div class="field" style="margin-top:12px"><label>Kenapa reason SFA itu dipilih?</label><input id="sfaWhy" class="input" value="${esc(d.sfa_selection_reason)}"></div><div class="grid2"><div class="field"><label>${t('revisit')}</label><select id="revisit" class="select"><option value="">-</option>${FOLLOWUP_OPTIONS.map(([k,l])=>`<option value="${k}" ${d.revisit_plan===k?'selected':''}>${l}</option>`).join('')}</select></div><div class="field"><label>${t('earlier')}</label><select id="earlier" class="select"><option value="">-</option><option value="YES" ${d.can_revisit_earlier==='YES'?'selected':''}>YA</option><option value="NO" ${d.can_revisit_earlier==='NO'?'selected':''}>TIDAK</option><option value="UNKNOWN" ${d.can_revisit_earlier==='UNKNOWN'?'selected':''}>TIDAK TAHU</option></select></div></div><div class="field"><label>${t('timing')}</label><textarea id="timing" class="textarea">${esc(d.followup_timing_reason)}</textarea></div><div class="field"><label>Quick Note</label><textarea id="quickNote" class="textarea">${esc(d.quick_note)}</textarea></div>${S.geoError?`<div class="notice bad">${esc(S.geoError)}</div>`:''}<div class="btn-row"><button class="btn btn-secondary" data-action="prevStage">←</button><button class="btn btn-primary" data-action="saveNonEc" ${S.geoBusy?'disabled':''}>${S.editingCallId?'Update Non-EC':'Simpan & Call Berikutnya'}</button></div>`;
}

function captureInputs(){
  const d=S.callDraft;if(!d)return;const g=id=>document.getElementById(id);
  if(g('outletName'))d.outlet_name=g('outletName').value;if(g('outletCodeDigits'))d.outlet_id=canonicalStoreCode(g('outletCodeDigits').value);if(g('omzet'))d.omzet=g('omzet').value===''?null:num(g('omzet').value);if(g('customReason'))d.custom_real_reason=g('customReason').value;if(g('evidence'))d.evidence=g('evidence').value;if(g('sfaWhy'))d.sfa_selection_reason=g('sfaWhy').value;if(g('revisit'))d.revisit_plan=g('revisit').value||null;if(g('earlier'))d.can_revisit_earlier=g('earlier').value||null;if(g('timing'))d.followup_timing_reason=g('timing').value;if(g('quickNote'))d.quick_note=g('quickNote').value;
  document.querySelectorAll('[data-rd-field]').forEach(el=>{if(!S.callDetailDraft)S.callDetailDraft=emptyReasonDetail(d.id,S.user.id);S.callDetailDraft[el.dataset.rdField]=el.value||null});
  document.querySelectorAll('[data-stock-index][data-stock-field]').forEach(el=>{const i=Number(el.dataset.stockIndex);if(S.stockDraft[i])S.stockDraft[i][el.dataset.stockField]=el.dataset.stockField==='stock_level'?(el.value||null):el.value});
  d.client_updated_at=nowISO();saveDraftLocal();
}
function validateRichDetail(){
  const code=S.callDraft.observed_reason_code,d=S.callDetailDraft||{};
  if(!d.recoverable_today){showToast('Isi: masih bisa order hari ini?');return false}
  if(code==='pic'&&!d.pic_status){showToast('Pilih kondisi PIC');return false}
  if(code==='closed'&&!d.closed_status){showToast('Pilih jenis toko tutup');return false}
  if(code==='financial'&&!d.financial_status){showToast('Pilih jenis kendala cash');return false}
  if(code==='refusal'&&!d.refusal_driver){showToast('Pilih penyebab belum butuh / menolak');return false}
  if(code==='competitor'&&!d.external_supplier_driver){showToast('Pilih alasan ambil dari supplier/grosir lain');return false}
  if(code==='price'&&!d.price_issue_type){showToast('Pilih jenis masalah harga');return false}
  if(code==='product'&&!d.product_issue_type){showToast('Pilih jenis kendala produk');return false}
  if(code==='unclear'&&!String(d.detail_notes||'').trim()){showToast('Tidak Jelas: tulis detail yang belum bisa dipastikan');return false}
  if(code==='stock'){
    if(!d.salesman_bombing_claim){showToast('Capture pengakuan salesman soal order sebelumnya');return false}
    if(!S.stockDraft.some(x=>String(x.product_name||'').trim())){showToast('BMA: tambahkan minimal satu barang/SKU yang masih ada');return false}
  }
  return true;
}
async function persistCallChildren(call){
  if(call.result==='NON_EC'){
    const detail={...(S.callDetailDraft||emptyReasonDetail(call.id,S.user.id)),call_id:call.id,jovis_user_id:call.jovis_user_id,source_version:APP_VERSION};
    await Local.put('reasonDetails',detail);const rix=S.reasonDetails.findIndex(x=>x.call_id===call.id);if(rix>=0)S.reasonDetails[rix]=detail;else S.reasonDetails.push(detail);await enqueue('reasonDetail','UPSERT',detail);
    const existing=stockItemsFor(call.id),keep=new Set(S.stockDraft.filter(x=>String(x.product_name||'').trim()).map(x=>x.id));
    for(const old of existing.filter(x=>!keep.has(x.id))){await Local.del('stockItems',old.id);S.stockItems=S.stockItems.filter(x=>x.id!==old.id);await enqueue('stockItem','DELETE',{id:old.id,call_id:call.id})}
    for(const item of S.stockDraft.filter(x=>String(x.product_name||'').trim())){const row={...item,id:item.id||uuid(),call_id:call.id,jovis_user_id:call.jovis_user_id,product_name:item.product_name.trim(),stock_level:item.stock_level||null};await Local.put('stockItems',row);const ix=S.stockItems.findIndex(x=>x.id===row.id);if(ix>=0)S.stockItems[ix]=row;else S.stockItems.push(row);await enqueue('stockItem','UPSERT',row)}
  }else{
    const old=reasonDetailFor(call.id);if(old){await Local.del('reasonDetails',call.id);S.reasonDetails=S.reasonDetails.filter(x=>x.call_id!==call.id);await enqueue('reasonDetail','DELETE',{call_id:call.id})}
    for(const item of stockItemsFor(call.id)){await Local.del('stockItems',item.id);S.stockItems=S.stockItems.filter(x=>x.id!==item.id);await enqueue('stockItem','DELETE',{id:item.id,call_id:call.id})}
  }
  for(const p of S.pendingPhotoMeta){await enqueue('photo','UPLOAD',p)}
}
async function saveCall(){
  captureInputs();const d=S.callDraft,v=S.visits.find(x=>x.id===d.visit_id);if(!v)return;
  if(callMethod(d)==='WHATSAPP'){if(!d.outlet_name.trim()&&!d.outlet_id.trim()){showToast('Isi toko');return}if(d.omzet===null||d.omzet===''){showToast(t('requiredOmzet'));return}d.result='EC';d.route_status='REMOTE';d.call_timestamp=d.call_timestamp||nowISO();d.checkin_at=null;d.checkout_at=null;d.duration_seconds=null}
  else{
    if(!S.editingCallId&&!d.checkin_at){S.geoError='Call VISIT harus Check In dengan lokasi.';render();return}
    if(!d.outlet_name.trim()&&!d.outlet_id.trim()){showToast('Isi nama toko atau kode toko');return}
    if(d.result==='EC'&&(d.omzet===null||d.omzet==='')){showToast(t('requiredOmzet'));return}
    if(d.result==='NON_EC'){
      if(!d.observed_reason_code){showToast('Pilih alasan aktual');return}
      if(d.observed_reason_code==='other'&&!d.custom_real_reason.trim()){showToast(t('customOtherRequired'));return}
      if(!validateRichDetail())return;
      if(!exactSfaCode(d)&&!safeLegacyExactCode(d)){showToast('Pilih exact reason SFA / E-Work');return}
      d.reason_match_status=dbCompatibleMatchStatus(d);
    }
    if(!d.result){showToast('Pilih hasil EC / Non-EC');return}
    if(d.result==='EC'){d.observed_reason_code=null;d.custom_real_reason='';d.contributing_factor=null;d.evidence='';d.sfa_reason_code=null;d.sfa_reason_exact_code=null;d.sfa_capture_type=null;d.sfa_recovery_status=null;d.reason_match_status=null;d.sfa_selection_reason='';d.revisit_plan=null;d.can_revisit_earlier=null;d.followup_timing_reason=''}
    if(!S.editingCallId){const ok=await captureCheckoutLocation();if(!ok)return;d.call_timestamp=d.checkin_at}
  }
  const wasEditing=!!S.editingCallId;d.client_updated_at=nowISO();await Local.put('calls',d);const ix=S.calls.findIndex(x=>x.id===d.id);if(ix>=0)S.calls[ix]=structuredClone(d);else S.calls.push(structuredClone(d));await enqueue('call','UPSERT',d);await persistCallChildren(d);await Local.del('drafts',`call:${v.id}`);
  if(wasEditing&&isAdmin()){clearCallState();route('admin-detail');showToast('Call diperbarui');return}
  if(wasEditing&&v.status==='completed'){clearCallState();S.selectedVisitId=v.id;route('analysis');showToast('Call diperbarui');return}
  resetCallDraft();render();showToast(callMethod(d)==='WHATSAPP'?'BY WA EC tersimpan':`Call tersimpan · ${fmtDuration(d.duration_seconds)}`);
}
async function editCall(id,visitId,{admin=false}={}){const c=S.calls.find(x=>x.id===id&&!x.is_deleted);if(!c)return;S.selectedVisitId=visitId;S.callDraft={...structuredClone(c),call_method:c.call_method||'VISIT'};S.callDetailDraft=reasonDetailFor(id)?structuredClone(reasonDetailFor(id)):emptyReasonDetail(id,c.jovis_user_id);S.stockDraft=stockItemsFor(id).map(x=>structuredClone(x));S.pendingPhotoIds=[];S.pendingPhotoMeta=[];if(c.result==='NON_EC'){S.callDraft.sfa_capture_type=normalizedCaptureType(c);S.callDraft.sfa_recovery_status=normalizedRecoveryStatus(c);S.callDraft.sfa_reason_exact_code=exactSfaCode(c)||safeLegacyExactCode(c)}S.callStage=0;S.editingCallId=id;route(admin?'admin-call-edit':'field')}
function renderAdminCallEdit(){if(!isAdmin()||!S.callDraft)return`<div class="card">No call selected.</div>`;return `<div class="card"><div class="section-head"><div><span class="pill blue">ADMIN EDIT</span><h1 style="margin-top:8px">${esc(S.callDraft.outlet_id||'')} · ${esc(S.callDraft.outlet_name)}</h1></div><button class="btn btn-secondary" data-route="admin-detail">Batal</button></div>${callMethod(S.callDraft)==='WHATSAPP'?renderWhatsappCall():renderCallStage()}</div>`}

async function stagePhotos(files){
  const cfg=photoConfig(),schema=reasonDetailSchema(S.callDraft?.observed_reason_code),limit=Number(cfg.maxPhotosPerCall||3),remaining=Math.max(0,limit-S.pendingPhotoMeta.length);
  for(const file of [...files].slice(0,remaining)){
    try{const row=await Media.stagePhoto({id:uuid(),callId:S.callDraft.id,userId:S.user.id,file,photoType:schema.photoType||'OTHER',config:cfg});S.pendingPhotoIds.push(row.id);S.pendingPhotoMeta.push(row)}catch(e){showToast(`Foto: ${e.message}`)}
  }
  await saveDraftLocal();render();
}

function renderRecovery(){
  const c=S.calls.find(x=>x.id===S.selectedRecoveryCallId&&!x.is_deleted);if(!c)return`<div class="card"><h1>Recovery</h1><div class="empty">Pilih Non-EC dari History/Recent Call.</div></div>`;
  const attempts=recoveryAttemptsFor(c.id),v=S.visits.find(x=>x.id===c.visit_id)||{};
  return `<div class="card"><span class="pill warn">POST-VISIT RECOVERY</span><h1 style="margin-top:10px">${esc(c.outlet_id||'')} · ${esc(c.outlet_name)}</h1><div class="meta">${fmtDate(v.visit_date)} · Initial NON-EC: ${esc(observedLabel(c,S.taxonomy,S.lang))}</div><div class="notice" style="margin-top:10px">Original Non-EC tidak diubah. Recovery disimpan sebagai event baru.</div></div><div class="card"><h2>Tambah Recovery Attempt</h2><form id="recoveryForm" data-call-id="${c.id}"><div class="grid2"><div class="field"><label>Channel</label><select class="select" name="channel" required><option value="WA">WhatsApp</option><option value="PHONE">Phone</option><option value="REVISIT">Revisit</option><option value="OTHER">Other</option></select></div><div class="field"><label>Outcome</label><select id="recoveryOutcome" class="select" name="outcome" required><option value="NO_RESPONSE">No Response</option><option value="STILL_NON_EC">Tetap Non-EC</option><option value="RECOVERED_EC">Recovered EC</option></select></div></div><div class="field"><label>Omzet Recovery (wajib jika Recovered EC)</label><input class="input" name="omzet" type="number" inputmode="numeric" min="0"></div><div class="field"><label>Catatan</label><textarea class="textarea" name="notes"></textarea></div><div class="btn-row"><button type="button" class="btn btn-secondary" data-route="home">Batal</button><button class="btn btn-primary">Simpan Recovery</button></div></form></div><div class="card"><h2>Recovery History</h2>${attempts.length?attempts.map(a=>`<div class="reason-card"><b>${a.channel} · ${a.outcome}</b><div class="meta">${fmtDate(a.attempted_at?.slice(0,10))} ${fmtTime(a.attempted_at)}${a.outcome==='RECOVERED_EC'?` · ${fmtCurrency(a.omzet)}`:''}</div><div class="small">${esc(a.notes||'')}</div></div>`).join(''):`<div class="empty">Belum ada attempt.</div>`}</div>`;
}
async function saveRecoveryAttempt(form){const call=S.calls.find(x=>x.id===form.dataset.callId&&!x.is_deleted);if(!call)return;const fd=Object.fromEntries(new FormData(form).entries());if(fd.outcome==='RECOVERED_EC'&&!fd.omzet){showToast('Omzet wajib untuk Recovered EC');return}const row={id:uuid(),call_id:call.id,visit_id:call.visit_id,jovis_user_id:call.jovis_user_id,attempted_at:nowISO(),channel:fd.channel,outcome:fd.outcome,omzet:fd.outcome==='RECOVERED_EC'?num(fd.omzet):null,notes:(fd.notes||'').trim(),client_created_at:nowISO(),client_updated_at:nowISO()};await Local.put('recoveryAttempts',row);S.recoveryAttempts.push(row);await enqueue('recoveryAttempt','UPSERT',row);showToast('Recovery tersimpan');route('home')}

function filteredData(){
  let visits=isAdmin()?S.visits.filter(v=>!v.is_deleted):myVisits();
  if(S.filters.date)visits=visits.filter(v=>v.visit_date===S.filters.date);if(S.filters.jovis)visits=visits.filter(v=>v.jovis_user_id===S.filters.jovis);if(S.filters.depot)visits=visits.filter(v=>v.depot===S.filters.depot);if(S.filters.salesman)visits=visits.filter(v=>String(v.salesman_name||'').toLowerCase().includes(S.filters.salesman.toLowerCase()));
  const ids=new Set(visits.map(v=>v.id)),calls=S.calls.filter(c=>ids.has(c.visit_id)&&!c.is_deleted),callIds=new Set(calls.map(c=>c.id));
  return {visits,calls,reasonDetails:S.reasonDetails.filter(x=>callIds.has(x.call_id)),stockItems:S.stockItems.filter(x=>callIds.has(x.call_id)),recoveryAttempts:S.recoveryAttempts.filter(x=>callIds.has(x.call_id)),photos:S.photos.filter(x=>callIds.has(x.call_id))};
}
function exportPayload(data){return {...data,taxonomy:S.taxonomy,profiles:S.profiles,language:S.lang}}
function renderAnalysis(){const v=S.selectedVisitId?S.visits.find(x=>x.id===S.selectedVisitId&&!x.is_deleted):null;const all=filteredData(),data=v?(()=>{const calls=visitCalls(v.id),ids=new Set(calls.map(c=>c.id));return{visits:[v],calls,reasonDetails:S.reasonDetails.filter(x=>ids.has(x.call_id)),stockItems:S.stockItems.filter(x=>ids.has(x.call_id)),recoveryAttempts:S.recoveryAttempts.filter(x=>ids.has(x.call_id)),photos:S.photos.filter(x=>ids.has(x.call_id))}})():all;const a=analyze(data.visits,data.calls,S.taxonomy,S.lang),findings=buildFindings(a,S.taxonomy,S.lang),intel=buildAdminIntelligence({...data,taxonomy:S.taxonomy,language:S.lang,minDirectionalSample:analysisRules().minDirectionalSample});return `<div class="card"><div class="section-head"><div><h1>${v?`${esc(v.depot)} · ${esc(v.salesman_name)}`:'Analisis JOVIS'}</h1><div class="meta">Visit EC/SC dipisahkan dari pure BY WA.</div></div><button class="btn btn-secondary" data-action="exportCurrent">Export</button></div><div class="kpis"><div class="kpi"><b>${intel.visitSc}</b><span>Visit SC</span></div><div class="kpi"><b>${intel.visitEc}</b><span>Visit EC</span></div><div class="kpi"><b>${intel.visitEcsc}%</b><span>Visit EC/SC</span></div><div class="kpi"><b>${intel.waEc}</b><span>Pure WA EC</span></div><div class="kpi"><b>${intel.recoveredEc}</b><span>Recovered EC</span></div><div class="kpi"><b>${fmtCurrency(intel.visitRevenue)}</b><span>Visit Omzet</span></div><div class="kpi"><b>${fmtCurrency(intel.waRevenue)}</b><span>WA Omzet</span></div><div class="kpi"><b>${fmtCurrency(intel.recoveredRevenue)}</b><span>Recovered Omzet</span></div></div></div><div class="card"><h2>Rule-based Findings</h2>${findings.length?findings.map(f=>`<div class="finding"><b>${esc(f.title)}</b><span>${esc(f.text)}</span></div>`).join(''):`<div class="empty">${t('noData')}</div>`}</div>${renderCallTable(data,false)}`}

function adminFilterBar(){const depots=[...new Set(S.visits.filter(v=>!v.is_deleted).map(v=>v.depot).filter(Boolean))].sort();return `<div class="admin-filters"><div class="field"><label>Date</label><input class="input" type="date" data-admin-filter="date" value="${S.filters.date}"></div><div class="field"><label>JOVIS</label><select class="select" data-admin-filter="jovis"><option value="">Semua</option>${S.profiles.filter(p=>p.role==='jovis').map(p=>`<option value="${p.id}" ${S.filters.jovis===p.id?'selected':''}>${esc(p.display_name||p.email)}</option>`).join('')}</select></div><div class="field"><label>Depot</label><select class="select" data-admin-filter="depot"><option value="">Semua</option>${depots.map(d=>`<option value="${esc(d)}" ${S.filters.depot===d?'selected':''}>${esc(d)}</option>`).join('')}</select></div><div class="field"><label>Salesman</label><input class="input" data-admin-filter="salesman" value="${esc(S.filters.salesman)}" placeholder="Search"></div></div>`}

function chartBars(rows,{valueSuffix='',empty='Belum ada data.',maxRows=8,includeZero=false,maxValue=null}={}){
  const clean=(rows||[]).filter(x=>Number.isFinite(Number(x.value))&&(includeZero||Number(x.value)>0)).slice(0,maxRows),max=Number.isFinite(Number(maxValue))&&Number(maxValue)>0?Number(maxValue):Math.max(0,...clean.map(x=>Number(x.value)||0));
  if(!clean.length)return `<div class="chart-empty">${esc(empty)}</div>`;
  return `<div class="hbar-chart">${clean.map(x=>{const v=Number(x.value)||0,w=max?Math.max(4,(v/max)*100):0;return `<div class="hbar-row"><div class="hbar-label"><span>${esc(x.label)}</span><b>${esc(String(x.display??`${v}${valueSuffix}`))}</b></div><div class="hbar-track"><span class="hbar-fill ${esc(x.cls||'')}" style="width:${w}%"></span></div></div>`}).join('')}</div>`;
}
function stackedBar(parts,total){
  const clean=(parts||[]).filter(x=>Number(x.value)>0),den=Number(total)||clean.reduce((s,x)=>s+Number(x.value||0),0);
  if(!den)return `<div class="chart-empty">Belum ada data.</div>`;
  return `<div class="stacked-chart"><div class="stacked-track">${clean.map(x=>`<span class="stack-seg ${esc(x.cls||'')}" style="width:${(Number(x.value)/den)*100}%" title="${esc(x.label)}: ${x.value}"></span>`).join('')}</div><div class="stacked-legend">${clean.map(x=>`<span><i class="legend-dot ${esc(x.cls||'')}"></i><b>${esc(x.label)}</b> ${x.value} · ${pct(x.value,den)}%</span>`).join('')}</div></div>`;
}
function filterContextLabel(){
  const bits=[];
  if(S.filters.date)bits.push(fmtDate(S.filters.date));
  if(S.filters.jovis)bits.push(profileName(S.filters.jovis));
  if(S.filters.depot)bits.push(S.filters.depot);
  if(S.filters.salesman)bits.push(`Salesman: ${S.filters.salesman}`);
  return bits.length?bits.join(' · '):'Semua data aktif';
}
function renderMismatchSummary(data){
  const a=analyze(data.visits,data.calls,S.taxonomy,S.lang),sfaOrder=S.taxonomy.filter(x=>x.reason_type==='sfa').sort((x,y)=>(x.sort_order??x.sort??0)-(y.sort_order??y.sort??0)).map(x=>x.reason_code),sfaRows=[...sfaOrder.filter(k=>a.sfaCounts[k]),...Object.keys(a.sfaCounts).filter(k=>!sfaOrder.includes(k)&&k!=='__UNRESOLVED__')];
  const actualRows=Object.keys(a.observedCounts).sort((x,y)=>(a.observedCounts[y]||0)-(a.observedCounts[x]||0));
  const expected={sfa_owner_absent:'pic',sfa_stock_available:'stock',sfa_no_cash:'financial',sfa_store_closed:'closed'};
  const actualLabel=k=>a.observedLabels[k]||k;
  const sfaName=k=>a.sfaLabels[k]||taxonomyLabel(k);
  const bySfaRows=sfaRows.map(code=>{const x=a.bySfa[code]||{};return `<tr><td><b>${esc(sfaName(code))}</b></td><td>${x.n||0}</td><td>${x.MATCH||0}</td><td>${x.PARTIAL||0}</td><td>${x.MISMATCH||0}</td><td>${x.NON_CAUSAL||0}</td><td>${x.TAXONOMY_GAP||0}</td><td><b>${x.evaluable?`${x.mismatchRate}%`:'-'}</b></td></tr>`}).join('');
  const matrixRows=sfaRows.map(sk=>`<tr><th>${esc(sfaName(sk))}</th>${actualRows.map(ok=>{const n=a.matrix?.[sk]?.[ok]||0;let cls='';if(n){if(expected[sk]===ok)cls='matrix-match';else if(sk==='sfa_call_later'||sk==='sfa_other')cls='matrix-neutral';else cls='matrix-mismatch'}return `<td class="${cls}">${n||''}</td>`}).join('')}</tr>`).join('');
  return `<section class="card mismatch-card"><div class="section-head"><div><h2>Akurasi Reason E-Work vs Alasan Aktual</h2><div class="meta">Hanya exact/recovered E-Work yang comparable; unresolved tidak dipaksa masuk mismatch.</div></div><div class="mismatch-kpis"><span><b>${a.sfaCoverage}%</b> SFA coverage</span><span><b>${a.evaluable}</b> comparable</span><span><b>${a.exactRate}%</b> match</span><span><b>${a.mismatchRate}%</b> mismatch</span></div></div>${sfaRows.length?`<div class="mismatch-layout"><div><h3>Akurasi per Reason E-Work</h3><div class="table-wrap"><table class="table compact-mismatch-table"><thead><tr><th>Reason E-Work</th><th>N</th><th>Match</th><th>Partial</th><th>Mismatch</th><th>Disposition</th><th>Taxonomy Gap</th><th>Mismatch %</th></tr></thead><tbody>${bySfaRows}</tbody></table></div></div><div><h3>Mismatch Matrix</h3><div class="table-wrap matrix-wrap"><table class="table mismatch-matrix"><thead><tr><th>E-Work \\ Aktual</th>${actualRows.map(k=>`<th>${esc(actualLabel(k))}</th>`).join('')}</tr></thead><tbody>${matrixRows}</tbody></table></div><div class="matrix-legend"><span><i class="legend-dot good"></i> Match</span><span><i class="legend-dot bad"></i> Mismatch</span><span><i class="legend-dot warn"></i> Disposition / taxonomy gap</span></div></div></div>`:`<div class="empty">Belum ada Non-EC dengan exact E-Work reason pada filter ini.</div>`}</section>`;
}
function renderSummaryCharts(data,intel){
  const issues=Object.entries(intel.reasonCounts).sort((a,b)=>b[1]-a[1]).map(([k,n])=>({label:observedLabel({observed_reason_code:k},S.taxonomy,S.lang),value:n,display:`${n} · ${pct(n,intel.visitNonEc)}%`,cls:'bad'}));
  const visitCallsOnly=data.calls.filter(c=>callMethod(c)==='VISIT'),gpsCount=visitCallsOnly.filter(c=>c.checkin_latitude!=null).length;
  return `<div class="summary-chart-grid"><section class="card chart-card"><div class="section-head"><div><h2>Visit Outcome</h2><div class="meta">EC/SC physical visit; pure WA tidak masuk denominator.</div></div><span class="pill">N=${intel.visitSc}</span></div>${stackedBar([{label:'EC',value:intel.visitEc,cls:'good'},{label:'Non-EC',value:intel.visitNonEc,cls:'bad'}],intel.visitSc)}</section><section class="card chart-card"><div class="section-head"><div><h2>Top Actual Non-EC Issues</h2><div class="meta">Ranking root cause berdasarkan observasi JOVIS.</div></div><span class="pill">N=${intel.visitNonEc}</span></div>${chartBars(issues,{maxRows:8})}</section><section class="card chart-card"><div class="section-head"><div><h2>Data Coverage</h2><div class="meta">Kelengkapan evidence untuk analisa lanjutan.</div></div></div>${chartBars([{label:'GPS Visit',value:pct(gpsCount,visitCallsOnly.length),display:`${gpsCount}/${visitCallsOnly.length} · ${pct(gpsCount,visitCallsOnly.length)}%`,cls:'blue'},{label:'Rich Non-EC Detail',value:pct(data.reasonDetails.length,intel.visitNonEc),display:`${data.reasonDetails.length}/${intel.visitNonEc} · ${pct(data.reasonDetails.length,intel.visitNonEc)}%`,cls:'blue'}],{maxRows:2,includeZero:true,maxValue:100})}<div class="coverage-mini-metrics"><span><b>${data.photos.length}</b> Photo Evidence</span><span><b>${data.recoveryAttempts.length}</b> Recovery Attempts</span></div>}</section></div>`;
}
async function screenshotAdminSummary(){
  const panel=document.getElementById('summaryCapturePanel');if(!panel)return;
  if(typeof window.html2canvas!=='function'){showToast('Screenshot engine belum termuat. Refresh lalu coba lagi.');return}
  const btn=document.querySelector('[data-action="screenshotSummary"]');if(btn)btn.disabled=true;
  try{showToast('Membuat PNG summary...');const canvas=await window.html2canvas(panel,{backgroundColor:'#f6f7f9',scale:Math.min(2,window.devicePixelRatio||1.5),useCORS:true,logging:false,windowWidth:1440,onclone:doc=>{const x=doc.getElementById('summaryCapturePanel');if(x){x.classList.add('screenshot-mode');x.style.width='1400px';x.style.maxWidth='1400px'}}});const a=document.createElement('a'),stamp=(S.filters.date||today()).replace(/[^0-9-]/g,'');a.download=`FVI_Summary_${stamp||today()}.png`;a.href=canvas.toDataURL('image/png',1);a.click();showToast('PNG summary tersimpan')}catch(e){showToast(`Screenshot gagal: ${e.message}`)}finally{if(btn)btn.disabled=false}
}
function renderResearchChart(id,data,intel){
  if(id==='Q1'){const rows=Object.entries(intel.reasonCounts).sort((a,b)=>b[1]-a[1]).map(([k,n])=>({label:observedLabel({observed_reason_code:k},S.taxonomy,S.lang),value:n,display:String(n),cls:'bad'}));return chartBars(rows,{maxRows:6})}
  if(id==='Q2'){const pic=data.calls.filter(c=>callMethod(c)==='VISIT'&&c.result==='NON_EC'&&c.observed_reason_code==='pic'),closed=data.calls.filter(c=>callMethod(c)==='VISIT'&&c.result==='NON_EC'&&c.observed_reason_code==='closed');const r=x=>x.filter(c=>intel.detailMap[c.id]?.recoverable_today==='YES').length,rec=x=>x.filter(c=>intel.recoveredMap[c.id]).length;return `<div class="grouped-metrics"><div><b>PIC</b>${stackedBar([{label:'Recovered',value:rec(pic),cls:'good'},{label:'Recoverable',value:Math.max(0,r(pic)-rec(pic)),cls:'blue'},{label:'Belum recoverable',value:Math.max(0,pic.length-r(pic)),cls:'muted'}],pic.length)}</div><div><b>Toko Tutup</b>${stackedBar([{label:'Recovered',value:rec(closed),cls:'good'},{label:'Recoverable',value:Math.max(0,r(closed)-rec(closed)),cls:'blue'},{label:'Belum recoverable',value:Math.max(0,closed.length-r(closed)),cls:'muted'}],closed.length)}</div></div>`}
  if(id==='Q3')return chartBars(Object.entries(intel.channels).map(([k,x])=>({label:k,value:x.conversion,display:`${x.recovered}/${x.attempts} · ${x.conversion}%`,cls:'good'})),{valueSuffix:'%',maxRows:4,empty:'Belum ada recovery attempt.',includeZero:(data.recoveryAttempts||[]).length>0,maxValue:100});
  if(id==='Q4'){const labels={OPEN_LATER_TODAY:'Buka lagi hari ini',REMOTE_ORDER_POSSIBLE:'Bisa order remote',EXCEPTIONAL_EVENT:'Event / exceptional',NO_SAME_DAY_CHANCE:'Tidak ada chance hari ini',PERMANENT_CLOSED:'Tutup permanen',UNCLASSIFIED:'Belum classified'};return chartBars(Object.entries(intel.closedTypes).map(([k,n])=>({label:labels[k]||k,value:n,display:String(n),cls:k==='PERMANENT_CLOSED'?'bad':k==='NO_SAME_DAY_CHANCE'?'warn':'blue'})),{maxRows:6,empty:'Belum ada toko tutup.'})}
  if(id==='Q5'){const b=intel.bombing;return chartBars([{label:'Salesman: terlalu besar',value:b.YES||0,display:String(b.YES||0),cls:'bad'},{label:'Salesman: tidak',value:b.NO||0,display:String(b.NO||0),cls:'good'},{label:'Tidak tahu',value:b.UNKNOWN||0,display:String(b.UNKNOWN||0),cls:'warn'},{label:'Belum dicapture',value:b.UNANSWERED||0,display:String(b.UNANSWERED||0),cls:'muted'}],{maxRows:4,empty:'Belum ada BMA.'})}
  return '';
}

function renderAdminSummary(){
  if(!isAdmin())return`<div class="card">Unauthorized</div>`;
  const data=filteredData(),intel=buildAdminIntelligence({...data,taxonomy:S.taxonomy,language:S.lang,minDirectionalSample:analysisRules().minDirectionalSample}),dwell=dwellStats(data.calls);
  return `<div class="admin-page-head"><div><span class="eyebrow">ADMIN INTELLIGENCE</span><h1>Summary Join Visit</h1><p>Executive snapshot untuk execution, recovery, reason accuracy, dan evidence quality.</p></div><div class="header-actions"><button class="btn btn-secondary" data-action="screenshotSummary">▣ Screenshot Summary</button><button class="btn btn-primary" data-action="exportAdmin">Export Detail</button><button class="btn btn-secondary" data-action="refresh">↻ Refresh</button></div></div><div class="card admin-filter-card">${adminFilterBar()}<button class="btn btn-ghost clear-filter-btn" data-action="clearAdminFilters">Reset Filter</button></div><section id="summaryCapturePanel" class="summary-capture-panel"><div class="capture-header"><div><span class="eyebrow">FIELD VISIT INTELLIGENCE</span><h2>Summary Join Visit</h2><div class="meta">${esc(filterContextLabel())}</div></div><div class="capture-stamp">Generated ${fmtDate(today())}</div></div><div class="admin-summary-grid"><section class="summary-group"><div class="summary-group-head"><span>FIELD EXECUTION</span></div><div class="kpis"><div class="kpi featured"><b>${intel.visitEcsc}%</b><span>Visit EC/SC</span></div><div class="kpi"><b>${intel.visitSc}</b><span>Visit SC</span></div><div class="kpi"><b>${intel.visitEc}</b><span>Visit EC</span></div><div class="kpi"><b>${fmtCurrency(intel.visitRevenue)}</b><span>Visit Omzet</span></div></div></section><section class="summary-group"><div class="summary-group-head"><span>REMOTE & RECOVERY</span></div><div class="kpis"><div class="kpi"><b>${intel.waEc}</b><span>Pure WA EC</span></div><div class="kpi"><b>${fmtCurrency(intel.waRevenue)}</b><span>WA Omzet</span></div><div class="kpi"><b>${intel.recoveredEc}</b><span>Recovered EC</span></div><div class="kpi"><b>${fmtCurrency(intel.recoveredRevenue)}</b><span>Recovered Omzet</span></div></div></section><section class="summary-group"><div class="summary-group-head"><span>NON-EC & EVIDENCE</span></div><div class="kpis"><div class="kpi"><b>${intel.visitNonEc}</b><span>Non-EC Visit</span></div><div class="kpi"><b>${intel.recoverableCount}</b><span>Recoverable Today</span></div><div class="kpi"><b>${fmtDuration(dwell.avg)}</b><span>Avg Duration</span></div><div class="kpi"><b>${data.photos.length}</b><span>Photo Evidence</span></div></div></section></div>${renderSummaryCharts(data,intel)}${renderMismatchSummary(data)}</section>${renderSfaRecovery(data)}`;
}

function detailFilterInput(key,type='text'){if(type==='select')return `<select class="table-filter" data-detail-filter="${key}"><option value="">All</option>${({method:['VISIT','WHATSAPP'],route:['JKS','OFF_ROUTE','REMOTE'],result:['EC','NON_EC'],recovery:['RECOVERED_EC','NO_RESPONSE','STILL_NON_EC'],photo:['YES','NO']}[key]||[]).map(x=>`<option value="${x}" ${S.detailFilters[key]===x?'selected':''}>${x}</option>`).join('')}</select>`;return `<input class="table-filter" data-detail-filter="${key}" value="${esc(S.detailFilters[key]||'')}" placeholder="Filter">`}
function adminRows(data){const intel=buildAdminIntelligence({...data,taxonomy:S.taxonomy,language:S.lang,minDirectionalSample:analysisRules().minDirectionalSample});return data.calls.map(c=>callAdminRow(c,{...data,profiles:S.profiles,taxonomy:S.taxonomy,language:S.lang,intel})).filter(r=>Object.entries(S.detailFilters).every(([k,v])=>{if(!v)return true;if(k==='gps')return String(`${r.lat},${r.long}`).toLowerCase().includes(v.toLowerCase());if(k==='duration')return String(r.duration).includes(v);if(k==='photo')return v==='YES'?r.photoCount>0:r.photoCount===0;if(k==='omzet')return String(r.omzet).includes(v);return String(r[k]??'').toLowerCase().includes(String(v).toLowerCase())}))}
function renderAdminVisitRegistry(data){
  const visits=[...data.visits].sort((a,b)=>String(b.start_time||'').localeCompare(String(a.start_time||'')));
  return `<div class="card admin-table-card"><div class="table-wrap"><table class="table admin-visit-table"><thead><tr><th>Date</th><th>JOVIS</th><th>Depot</th><th>Salesman</th><th>Status</th><th>SC</th><th>EC</th><th>EC/SC</th><th>WA</th><th>Recovered</th><th>Start</th><th>Action</th></tr></thead><tbody>${visits.map(v=>{const z=visitStats(v),ids=new Set(visitCalls(v.id).map(c=>c.id)),rec=S.recoveryAttempts.filter(a=>ids.has(a.call_id)&&a.outcome==='RECOVERED_EC').length;return `<tr><td>${esc(v.visit_date||'')}</td><td>${esc(profileName(v.jovis_user_id))}</td><td><b>${esc(v.depot||'')}</b></td><td>${esc(v.salesman_name||'')}</td><td><span class="pill ${v.status==='active'?'blue':'good'}">${v.status==='active'?'Aktif':'Selesai'}</span></td><td>${z.sc}</td><td>${z.ec}</td><td><b>${z.ecsc}%</b></td><td>${z.wa}</td><td>${rec}</td><td>${fmtTime(v.start_time)}</td><td><div class="action-stack"><button class="btn btn-secondary" data-admin-view-visit="${v.id}">Buka</button><button class="btn btn-danger" data-admin-delete-visit="${v.id}">Hapus</button></div></td></tr>`}).join('')||`<tr><td colspan="12"><div class="empty">Belum ada visit sesuai filter.</div></td></tr>`}</tbody></table></div></div>`;
}

function renderAdminDetail(){
  if(!isAdmin())return`<div class="card">Unauthorized</div>`;
  const data=filteredData(),mode=S.adminDetailMode||'calls';
  const head=`<div class="admin-page-head compact"><div><span class="eyebrow">DATA EXPLORER</span><h1>Detail</h1><p>Inspect sampai row, GPS, evidence, recovery, dan foto.</p></div><div class="header-actions"><button class="btn btn-primary" data-action="exportAdmin">Export</button></div></div><div class="card admin-filter-card"><div class="toolbar admin-mode-tabs"><button class="tab ${mode==='calls'?'active':''}" data-admin-detail-mode="calls">Calls</button><button class="tab ${mode==='visits'?'active':''}" data-admin-detail-mode="visits">Visits</button></div>${adminFilterBar()}<button class="btn btn-ghost clear-filter-btn" data-action="clearAdminFilters">Reset Filter</button></div>`;
  if(mode==='visits')return `${head}<div class="section-caption"><b>${data.visits.length}</b> visit sesuai filter · seluruh akun JOVIS terlihat di sini.</div>${renderAdminVisitRegistry(data)}`;
  const rows=adminRows(data),selected=S.adminSelectedCallId?rows.find(r=>r.call.id===S.adminSelectedCallId):null;
  const table=`<div class="card admin-table-card"><div class="table-wrap"><table class="table admin-detail-table"><thead><tr><th>Date</th><th>JOVIS</th><th>Depot</th><th>Salesman</th><th>Kode Toko</th><th>Nama Toko</th><th>Method</th><th>Route</th><th>Result</th><th>Omzet</th><th>Actual</th><th>SFA Exact</th><th>Recovery</th><th>Duration</th><th>Lat/Long</th><th>Evidence</th><th>Photo</th><th></th></tr><tr class="filter-row"><th>${detailFilterInput('date')}</th><th>${detailFilterInput('jovis')}</th><th>${detailFilterInput('depot')}</th><th>${detailFilterInput('salesman')}</th><th>${detailFilterInput('outletId')}</th><th>${detailFilterInput('outletName')}</th><th>${detailFilterInput('method','select')}</th><th>${detailFilterInput('route','select')}</th><th>${detailFilterInput('result','select')}</th><th>${detailFilterInput('omzet')}</th><th>${detailFilterInput('actual')}</th><th>${detailFilterInput('sfa')}</th><th>${detailFilterInput('recovery','select')}</th><th>${detailFilterInput('duration')}</th><th>${detailFilterInput('gps')}</th><th>${detailFilterInput('evidence')}</th><th>${detailFilterInput('photo','select')}</th><th><button class="mini-reset" data-action="clearDetailFilters">Reset</button></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.jovis)}</td><td>${esc(r.depot)}</td><td>${esc(r.salesman)}</td><td><b>${esc(r.outletId)}</b></td><td>${esc(r.outletName)}</td><td><span class="pill ${r.method==='WHATSAPP'?'good':'blue'}">${esc(r.method)}</span></td><td>${esc(r.route)}</td><td><b class="result-text ${r.result==='EC'?'good':'bad'}">${esc(r.result)}</b></td><td>${r.result==='EC'?fmtCurrency(r.omzet):''}</td><td>${esc(r.actual)}</td><td>${esc(r.sfa)}</td><td>${esc(r.recovery)}</td><td>${fmtDuration(r.duration)}</td><td>${r.lat!==''&&r.long!==''?`<a class="coord-link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${encodeURIComponent(`${r.lat},${r.long}`)}">${Number(r.lat).toFixed(5)}, ${Number(r.long).toFixed(5)}</a><div class="tiny muted">±${Math.round(Number(r.accuracy)||0)}m</div>`:'-'}</td><td class="evidence-cell">${esc(r.evidence)}</td><td>${r.photoCount?`<button class="btn btn-secondary" data-photo-call="${r.call.id}">📷 ${r.photoCount}</button>`:'-'}</td><td><div class="action-stack"><button class="btn btn-secondary" data-show-call="${r.call.id}">Detail</button><button class="btn btn-ghost" data-admin-edit-call="${r.call.id}" data-visit-id="${r.call.visit_id}">Edit</button></div></td></tr>`).join('')||`<tr><td colspan="18"><div class="empty">Belum ada call sesuai filter.</div></td></tr>`}</tbody></table></div></div>`;
  return `${head}<div class="section-caption"><b>${rows.length}</b> call sesuai filter · filter per header tersedia di tabel.</div>${selected?`<div class="admin-detail-layout"><div>${table}</div><aside>${renderSelectedCall(selected,data)}</aside></div>`:table}`;
}

function detailValueLabel(field,value){if(value===null||value===undefined||value==='')return'';const hit=optionRows(field).find(([k])=>k===value);return hit?hit[1]:String(value)}
function renderReasonDetailReadout(d){if(!d||!d.call_id)return'<div class="empty small">Belum ada rich reason detail.</div>';const fields=reasonDetailSchema(S.calls.find(c=>c.id===d.call_id)?.observed_reason_code).fields;const rows=fields.filter(f=>d[f]!==null&&d[f]!==undefined&&String(d[f]).trim()!=='').map(f=>`<div><label>${esc(FIELD_META[f]?.label||f)}</label><b>${esc(detailValueLabel(f,d[f]))}</b></div>`);return rows.length?`<div class="detail-grid">${rows.join('')}</div>`:'<div class="empty small">Belum ada rich reason detail.</div>'}
function compactReasonDetail(d,stocks=[]){if(!d)return'';const parts=[];if(d.recoverable_today)parts.push(`Recoverable Today: ${detailValueLabel('recoverable_today',d.recoverable_today)}`);for(const f of ['pic_status','closed_status','financial_status','refusal_driver','price_issue_type','product_issue_type','external_supplier_driver','salesman_bombing_claim'])if(d[f])parts.push(`${FIELD_META[f]?.label||f}: ${detailValueLabel(f,d[f])}`);if(d.external_supplier_name)parts.push(`Supplier: ${d.external_supplier_name}`);if(d.affected_products)parts.push(`Produk: ${d.affected_products}`);if(stocks.length)parts.push(`Stock: ${stocks.map(x=>x.product_name+(x.stock_level?` (${x.stock_level})`:'')).join(', ')}`);return parts.join(' · ')}
function renderSelectedCall(r,data){const d=reasonDetailFor(r.call.id)||{},stocks=stockItemsFor(r.call.id),attempts=recoveryAttemptsFor(r.call.id),photos=photosFor(r.call.id);return `<div class="card detail-panel"><div class="section-head"><div><span class="pill blue">CALL DETAIL</span><h2 style="margin-top:8px">${esc(r.outletId)} · ${esc(r.outletName)}</h2></div><button class="btn btn-secondary" data-action="closeCallDetail">Tutup</button></div><div class="detail-grid"><div><label>JOVIS / Salesman</label><b>${esc(r.jovis)} / ${esc(r.salesman)}</b></div><div><label>Method / Result</label><b>${esc(r.method)} / ${esc(r.result)}</b></div><div><label>Actual / SFA</label><b>${esc(r.actual||'-')} / ${esc(r.sfa||'-')}</b></div><div><label>Omzet</label><b>${r.result==='EC'?fmtCurrency(r.omzet):'-'}</b></div><div><label>GPS</label><b>${r.lat!==''?`<a class="coord-link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${encodeURIComponent(`${r.lat},${r.long}`)}">${r.lat}, ${r.long}</a> ±${r.accuracy}m`:'-'}</b></div><div><label>Duration</label><b>${fmtDuration(r.duration)}</b></div></div>${r.call.result==='NON_EC'?`<h3 style="margin-top:14px">Rich Reason Detail</h3>${renderReasonDetailReadout(d)}`:''}<h3 style="margin-top:14px">Evidence</h3><div class="notice">${esc(r.call.evidence||'-')}</div>${stocks.length?`<h3 style="margin-top:14px">BMA Stock Items</h3><div class="metrics">${stocks.map(x=>`<span class="metric">${esc(x.product_name)} · ${esc(x.stock_level||'')} · ${esc(x.qty_note||'')}</span>`).join('')}</div>`:''}${attempts.length?`<h3 style="margin-top:14px">Recovery Attempts</h3>${attempts.map(a=>`<div class="reason-card"><b>${a.channel} · ${a.outcome}</b><div class="meta">${fmtTime(a.attempted_at)}${a.outcome==='RECOVERED_EC'?` · ${fmtCurrency(a.omzet)}`:''}</div>${esc(a.notes||'')}</div>`).join('')}`:''}${photos.length?`<h3 style="margin-top:14px">Photo Evidence</h3><button class="btn btn-secondary" data-photo-call="${r.call.id}">📷 Buka ${photos.length} Foto</button>`:''}</div>`}

function renderAdminMap(){
  if(!isAdmin())return`<div class="card">Unauthorized</div>`;
  const data=filteredData(),gpsCount=data.calls.filter(c=>callMethod(c)==='VISIT'&&c.checkin_latitude!=null).length,sfaReasons=S.taxonomy.filter(x=>x.reason_type==='sfa').sort((a,b)=>(a.sort_order??a.sort??0)-(b.sort_order??b.sort??0));
  return `<div class="admin-page-head compact"><div><span class="eyebrow">JOIN VISIT MAP</span><h1>Perjalanan JOVIS</h1><p>Lingkaran hijau = EC, merah = Non-EC. Nomor mengikuti urutan check-in.</p></div><button class="btn btn-secondary" data-action="refresh">↻ Refresh</button></div><div class="card admin-filter-card">${adminFilterBar()}<div class="map-control-grid"><div><label>Result</label><div class="map-legend-filter"><button class="legend-filter ${!S.mapFilters.result?'active':''}" data-map-result=""><i class="legend-dot neutral"></i>Semua</button><button class="legend-filter ${S.mapFilters.result==='EC'?'active':''}" data-map-result="EC"><i class="legend-dot good"></i>EC</button><button class="legend-filter ${S.mapFilters.result==='NON_EC'?'active':''}" data-map-result="NON_EC"><i class="legend-dot bad"></i>Non-EC</button></div></div><div><label>Reason E-Work</label><select class="select" data-map-filter="reason"><option value="">Semua Reason E-Work</option>${sfaReasons.map(x=>`<option value="${x.reason_code}" ${S.mapFilters.reason===x.reason_code?'selected':''}>${esc(x.reason_label_id)}</option>`).join('')}</select></div></div><div class="ework-legend"><span class="legend-title">Filter cepat E-Work:</span><button class="reason-legend-chip ${!S.mapFilters.reason?'active':''}" data-map-reason="">Semua</button>${sfaReasons.map(x=>`<button class="reason-legend-chip ${S.mapFilters.reason===x.reason_code?'active':''}" data-map-reason="${x.reason_code}">${esc(x.reason_label_id)}</button>`).join('')}</div></div><div class="map-statbar"><span><b>${gpsCount}</b> GPS calls</span><span><b>${data.visits.length}</b> visits</span><span><b>${data.calls.filter(c=>c.result==='NON_EC').length}</b> Non-EC</span></div><div class="card map-card"><div id="adminMap" class="admin-map"></div><div class="meta map-note">Garis menunjukkan sequence check-in, bukan actual road travelled. BY WA tidak mempunyai titik GPS.</div></div>`
}
function mapCallRows(){const data=filteredData(),intel=buildAdminIntelligence({...data,taxonomy:S.taxonomy,language:S.lang,minDirectionalSample:analysisRules().minDirectionalSample});const calls=data.calls.filter(c=>callMethod(c)==='VISIT'&&c.checkin_latitude!=null&&c.checkin_longitude!=null).filter(c=>!S.mapFilters.result||c.result===S.mapFilters.result).filter(c=>!S.mapFilters.reason||(exactSfaCode(c)||safeLegacyExactCode(c))===S.mapFilters.reason);const sorted=[...calls].sort((a,b)=>String(a.checkin_at||a.call_timestamp||'').localeCompare(String(b.checkin_at||b.call_timestamp||'')));return sorted.map((c,i)=>({c,i:i+1,intel}))}
function initAdminMap(){const el=document.getElementById('adminMap');if(!el)return;if(!window.L){el.innerHTML='<div class="empty">Map library gagal dimuat. Pastikan internet aktif.</div>';return}const rows=mapCallRows();if(!rows.length){el.innerHTML='<div class="empty">Tidak ada VISIT dengan GPS pada filter ini.</div>';return}const L=window.L,map=L.map(el),groups={};L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);const allLatLng=[];for(const {c,i,intel} of rows){const ll=[Number(c.checkin_latitude),Number(c.checkin_longitude)],v=S.visits.find(x=>x.id===c.visit_id)||{},attempts=intel.attemptsByCall[c.id]||[],recovered=intel.recoveredMap[c.id],photos=intel.photosByCall[c.id]||[],d=intel.detailMap[c.id]||{},stocks=intel.stockByCall[c.id]||[];allLatLng.push(ll);(groups[c.visit_id]??=[]).push(ll);const rich=compactReasonDetail(d,stocks);const popup=`<div class="map-popup"><b>#${i} · ${esc(c.outlet_id||'')} · ${esc(c.outlet_name)}</b><div>${esc(v.visit_date||'')} · ${esc(profileName(c.jovis_user_id))} · ${esc(v.salesman_name||'')}</div><div>${fmtTime(c.checkin_at)}–${fmtTime(c.checkout_at)} · ${fmtDuration(c.duration_seconds)}</div><div>${esc(c.route_status)} · <b>${esc(c.result)}</b>${c.result==='EC'?` · ${fmtCurrency(c.omzet)}`:''}</div>${c.result==='NON_EC'?`<div>Actual: ${esc(observedLabel(c,S.taxonomy,S.lang))}</div><div>E-Work: ${esc(sfaLabel(c,S.taxonomy,S.lang)||'Unresolved')}</div>${rich?`<div>${esc(rich)}</div>`:''}<div>Recovery: ${recovered?`RECOVERED ${fmtCurrency(recovered.omzet)}`:(attempts.at(-1)?.outcome||'-')}</div><div>Evidence: ${esc(c.evidence||'-')}</div>`:''}<div>GPS ${Number(c.checkin_latitude).toFixed(5)}, ${Number(c.checkin_longitude).toFixed(5)} ±${Math.round(Number(c.checkin_accuracy_m)||0)}m</div>${photos.length?`<button class="map-photo-btn" data-photo-call="${c.id}">📷 ${photos.length} foto</button>`:''}</div>`;const marker=L.circleMarker(ll,{radius:11,weight:3,color:'#ffffff',fillColor:c.result==='EC'?'#168253':'#c51e2d',fillOpacity:.95}).addTo(map).bindTooltip(String(i),{permanent:true,direction:'center',className:'circle-sequence-label',offset:[0,0]}).bindPopup(popup);marker.on('mouseover',()=>marker.setRadius(13));marker.on('mouseout',()=>marker.setRadius(11))}for(const points of Object.values(groups))if(points.length>1)L.polyline(points,{color:'#667085',weight:2,opacity:.55,dashArray:'5 7'}).addTo(map);map.fitBounds(allLatLng,{padding:[28,28],maxZoom:16})}

function renderAdminAnalysis(){
  if(!isAdmin())return`<div class="card">Unauthorized</div>`;
  const data=filteredData(),intel=buildAdminIntelligence({...data,taxonomy:S.taxonomy,language:S.lang,minDirectionalSample:analysisRules().minDirectionalSample});
  return `<div class="admin-page-head compact"><div><span class="eyebrow">RULE-BASED RESEARCH</span><h1>Pertanyaan Join Visit</h1><p>Setiap jawaban didampingi visual evidence. Jika sample belum cukup, status tetap Evidence Insufficient.</p></div></div><div class="card admin-filter-card">${adminFilterBar()}</div><div class="research-grid">${intel.questions.map(q=>`<div class="card research-card"><div class="research-top"><span class="pill ${q.status==='DIRECTIONAL'?'good':'warn'}">${q.status==='DIRECTIONAL'?'Directional':'Evidence Insufficient'}</span><span class="sample-badge">N=${q.sample}</span></div><div class="question-id">${q.id}</div><h2>${esc(q.title)}</h2><p>${esc(q.answer)}</p><div class="research-chart">${renderResearchChart(q.id,data,intel)}</div></div>`).join('')}</div><div class="analysis-support-grid"><div class="card"><div class="section-head"><div><h2>Recovery Channel</h2><div class="meta">Recovered/attempts dan conversion rate.</div></div></div>${chartBars(Object.entries(intel.channels).map(([k,x])=>({label:k,value:x.conversion,display:`${x.recovered}/${x.attempts} · ${x.conversion}% · ${fmtCurrency(x.revenue)}`,cls:'good'})),{valueSuffix:'%',maxRows:4,empty:'Belum ada recovery attempt.',includeZero:(data.recoveryAttempts||[]).length>0,maxValue:100})}</div><div class="card"><div class="section-head"><div><h2>BMA · Pengakuan Salesman</h2><div class="meta">Claim bukan bukti bombing; validasi tetap dari DBase historical order.</div></div></div>${renderResearchChart('Q5',data,intel)}<div class="notice" style="margin-top:10px">Claim salesman bukan bukti bombing. Validasi final tetap menggunakan DBase historical order.</div></div></div>`
}

function renderSfaRecovery(data){if(!isAdmin())return'';const legacy=data.calls.filter(c=>c.result==='NON_EC'&&normalizedCaptureType(c)==='LEGACY'),unresolved=legacy.filter(c=>!exactSfaCode(c)&&!safeLegacyExactCode(c));return `<div class="card"><div class="section-head"><div><h2>SFA Legacy Recovery</h2><div class="meta">Nilai legacy dipreserve; exact E-Work ditambahkan ke Call ID yang sama.</div></div><span class="pill ${unresolved.length?'warn':'good'}">${unresolved.length} unresolved</span></div>${unresolved.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Outlet</th><th>Actual</th><th>Legacy</th><th>Evidence</th><th>Suggestion</th><th>Reason yang Dipilih Salesman di E-Work</th><th></th></tr></thead><tbody>${unresolved.map(c=>{const sug=recoverySuggestion(c);return`<tr><td>${esc(c.outlet_id||'')}<br>${esc(c.outlet_name)}</td><td>${esc(observedLabel(c,S.taxonomy,S.lang))}</td><td>${esc(legacySfaLabel(c,S.taxonomy,S.lang)||c.sfa_reason_code||'-')}</td><td>${esc(c.evidence||'-')}</td><td>${sug?esc(taxonomyLabel(sug.code)):'-'}</td><td><select class="select" data-recovery-select="${c.id}"><option value="">Pilih</option>${exactSfaOptions(sug?.code||'')}</select></td><td><button class="btn btn-primary" data-confirm-recovery="${c.id}">Confirm</button></td></tr>`}).join('')}</tbody></table></div>`:`<div class="notice good">Semua legacy pada filter ini sudah resolved.</div>`}</div>`}
async function confirmLegacyRecovery(callId){const c=S.calls.find(x=>x.id===callId&&!x.is_deleted);if(!c)return;const code=document.querySelector(`[data-recovery-select="${callId}"]`)?.value||'';if(!code){showToast('Pilih reason E-Work yang benar-benar dipilih salesman');return}const patch={...c,sfa_reason_exact_code:code,sfa_capture_type:'LEGACY',sfa_recovery_status:'MANUAL_CONFIRMED',client_updated_at:nowISO()};patch.reason_match_status=dbCompatibleMatchStatus(patch);await Local.put('calls',patch);S.calls[S.calls.findIndex(x=>x.id===callId)]=patch;await enqueue('call','UPSERT',patch);render();showToast('Reason E-Work dikonfirmasi')}

async function openCallPhotos(callId){const rows=photosFor(callId);if(!rows.length){showToast('Belum ada foto tersinkron');return}const w=window.open('about:blank','_blank');try{const urls=await Promise.all(rows.map(async r=>({r,url:await Media.signedPhotoUrl(r.storage_path,900)})));if(!w){showToast('Popup foto diblok browser. Izinkan popup lalu coba lagi.');return}try{w.opener=null}catch{}w.document.write(`<title>FVI Photo Evidence</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;margin:20px;background:#f6f7f9}.card{background:#fff;padding:12px;border-radius:12px;margin-bottom:14px}img{max-width:100%;height:auto;border-radius:8px}.meta{color:#666;font-size:13px}</style><h2>Photo Evidence · ${esc(callId)}</h2>${urls.map(({r,url})=>`<div class="card"><div class="meta">${esc(r.photo_type||'OTHER')} · ${esc(r.caption||'')}</div><img src="${esc(url||'')}" alt="Evidence"></div>`).join('')}`);w.document.close()}catch(e){if(w)w.close();showToast(`Foto: ${e.message}`)}}

async function loadDiagnosticsData(){const q=await queueDiagnostics();S.queueItems=q.items||[];return q}
async function runQaDiagnostics(){
  const checks=[];
  try{const x=await Cloud.fetchDataset();checks.push(['Core Cloud Read','PASS',`${x.visits.length} visit · ${x.calls.length} calls`]);if(x.warnings?.length)checks.push(['Rich Cloud Read','WARN',x.warnings.join(' | ')])}catch(e){checks.push(['Core Cloud Read','FAIL',e.message])}
  try{const x=await Cloud.diagnosticSnapshot();checks.push(['Supabase/RLS Rich','PASS',`${x.profiles.length} profile · ${x.visits.length} visit · ${x.calls.length} calls · ${x.reasonDetails.length} details · ${x.recoveryAttempts.length} recovery`])}catch(e){checks.push(['Supabase/RLS Rich','FAIL',e.message])}
  try{await Local.all('reasonDetails');checks.push(['IndexedDB v2','PASS','Rich evidence stores available'])}catch(e){checks.push(['IndexedDB v2','FAIL',e.message])}
  S.diagnostics=checks;await loadDiagnosticsData();render();
}
function renderSyncDiagnostics(){
  const diag=S.diagnostics?S.diagnostics.map(([n,s,m])=>`<div class="diag-row"><span class="pill ${s==='PASS'?'good':s==='WARN'?'warn':'bad'}">${s}</span><div><b>${esc(n)}</b><div class="meta">${esc(m)}</div></div></div>`).join(''):'';
  const queue=S.queueItems.length?`<div class="notice warn" style="margin-top:10px">Queue ${S.queueItems.length} item · ${S.queueItems.filter(x=>x.status==='ERROR').length} error</div><div class="sync-queue-list">${S.queueItems.map(x=>`<div class="sync-queue-item"><div><b>${esc(x.entity)} · ${esc(x.operation)}</b><div class="meta">${esc(x.status)} · attempts ${x.attempts||0}</div>${x.last_error?`<div class="error-cell">${esc(x.last_error)}</div>`:''}</div><button class="btn btn-secondary" data-retry-queue="${x.id}">Retry</button></div>`).join('')}</div><button class="btn btn-secondary" style="margin-top:8px" data-action="retryAllErrors">Retry All Errors</button>`:`<div class="notice good" style="margin-top:10px">Queue kosong.</div>`;
  return `<div class="card"><div class="section-head"><h2>Sync & Diagnostic</h2><button class="btn btn-secondary" data-action="runDiagnostics">Run Diagnostic</button></div>${diag}${S.cloudWarnings.length?`<div class="notice warn" style="margin-top:8px"><b>Cloud degraded:</b> ${esc(S.cloudWarnings.join(' | '))}</div>`:''}${queue}</div>`;
}
function renderSettings(){
  const cfg=photoConfig(),rules=analysisRules();
  if(!isAdmin())return `<div class="card"><h1>${t('settings')}</h1><div class="field"><label>Language</label><select id="languageSelect" class="select"><option value="id" ${S.lang==='id'?'selected':''}>Bahasa Indonesia</option><option value="en" ${S.lang==='en'?'selected':''}>English</option></select></div><div class="notice good">Supabase = source of truth; IndexedDB = local cache/offline queue.</div><div class="btn-row" style="margin-top:12px"><button class="btn btn-secondary" data-action="backupJson">JSON Backup</button><button class="btn btn-danger" data-action="logout">${t('logout')}</button></div></div>${renderSyncDiagnostics()}`;
  return `<div class="card"><span class="pill blue">ADMIN SETTINGS</span><h1 style="margin-top:8px">Pengaturan</h1><p class="muted">Settings operasional dan governance; tidak ada workflow Visit untuk Admin.</p></div><div class="card"><h2>Photo & Analysis Rules</h2><form id="appSettingsForm"><div class="grid4"><div class="field"><label>Max dimension px</label><input class="input" name="maxDimension" type="number" min="640" max="2048" value="${cfg.maxDimension||1280}"></div><div class="field"><label>JPEG/WebP Quality</label><input class="input" name="quality" type="number" min="0.4" max="0.95" step="0.01" value="${cfg.quality||0.78}"></div><div class="field"><label>Max photos / call</label><input class="input" name="maxPhotosPerCall" type="number" min="1" max="5" value="${cfg.maxPhotosPerCall||3}"></div><div class="field"><label>Min directional sample</label><input class="input" name="minDirectionalSample" type="number" min="1" max="100" value="${rules.minDirectionalSample||5}"></div></div><button class="btn btn-primary">Simpan Settings</button></form></div><div class="card"><h2>User Accounts</h2><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${S.profiles.map(p=>`<tr><td>${esc(p.display_name||'')}</td><td>${esc(p.email||'')}</td><td>${esc(p.role)}</td><td>${p.active?'Active':'Inactive'}</td><td>${p.id!==S.user.id?`<button class="btn btn-secondary" data-toggle-user="${p.id}" data-next-active="${p.active?'false':'true'}">${p.active?'Nonaktifkan':'Aktifkan'}</button>`:''}</td></tr>`).join('')}</tbody></table></div></div><div class="card"><h2>Reason Configuration</h2><p class="muted small">Exact SFA/E-Work dan Actual Reason tetap dipisahkan. Dynamic detail questions berada di config module dan ditampilkan per Actual Reason.</p><div class="grid2"><div><h3>Exact SFA</h3>${S.taxonomy.filter(x=>x.reason_type==='sfa').map(x=>`<div class="metric" style="margin:4px 0">${esc(x.reason_label_id)}</div>`).join('')}</div><div><h3>Actual Reasons</h3>${S.taxonomy.filter(x=>x.reason_type==='observed').map(x=>`<div class="metric" style="margin:4px 0">${esc(x.reason_label_id)} · ${REASON_DETAIL_SCHEMA[x.reason_code]?.fields?.length||0} detail fields</div>`).join('')}</div></div></div><div class="card danger-zone"><h2>Data Maintenance</h2><button class="btn btn-danger" data-action="purgeTestVisits">Hapus Visit Testing</button></div>${renderSyncDiagnostics()}<div class="card"><button class="btn btn-danger" data-action="logout">${t('logout')}</button></div>`;
}

async function submitVisit(form){const fd=Object.fromEntries(new FormData(form).entries()),editId=form.dataset.editId;if(editId){const v=S.visits.find(x=>x.id===editId);Object.assign(v,{visit_date:fd.visit_date,depot:fd.depot.trim(),salesman_name:fd.salesman_name.trim(),salesman_id:fd.salesman_id.trim(),notes:fd.notes.trim(),client_updated_at:nowISO()});await Local.put('visits',v);await enqueue('visit','UPSERT',v);route('analysis',{visitId:v.id});return}if(activeVisit()){showToast(t('oneActive'));return}const v={id:uuid(),jovis_user_id:S.user.id,visit_date:fd.visit_date,depot:fd.depot.trim(),salesman_name:fd.salesman_name.trim(),salesman_id:fd.salesman_id.trim(),route_segment:null,notes:fd.notes.trim(),start_time:nowISO(),end_time:null,status:'active',client_created_at:nowISO(),client_updated_at:nowISO(),is_deleted:false};await Local.put('visits',v);S.visits.push(v);await enqueue('visit','UPSERT',v);S.selectedVisitId=v.id;resetCallDraft();route('field')}
async function endVisit(){const v=activeVisit();if(!v)return;if(S.callDraft?.checkin_at&&!S.editingCallId){showToast('Selesaikan call yang sudah Check In.');return}if(!confirm(`Selesaikan visit dengan ${visitCalls(v.id).length} total call?`))return;v.status='completed';v.end_time=nowISO();v.client_updated_at=nowISO();await Local.put('visits',v);await enqueue('visit','UPSERT',v);await Local.del('drafts',`call:${v.id}`);clearCallState();S.selectedVisitId=v.id;route('analysis')}
async function deleteVisitCascade(visitId,{silent=false}={}){if(!isAdmin())return;const v=S.visits.find(x=>x.id===visitId);if(!v)return;if(!silent&&!confirm('Hapus visit ini dari dataset aktif?'))return;const deletedAt=nowISO(),related=visitCalls(v.id),vp={...v,is_deleted:true,deleted_at:deletedAt,client_updated_at:deletedAt};await Local.put('visits',vp);await enqueue('visit','UPSERT',vp);S.visits[S.visits.findIndex(x=>x.id===v.id)]=vp;for(const c of related){const cp={...c,is_deleted:true,deleted_at:deletedAt,client_updated_at:deletedAt};await Local.put('calls',cp);await enqueue('call','UPSERT',cp);S.calls[S.calls.findIndex(x=>x.id===c.id)]=cp}if(!silent){route('admin-summary');showToast('Visit dihapus dari dataset aktif')}}
async function purgeTestVisits(){const xs=S.visits.filter(v=>!v.is_deleted&&(/^(test|qa)$/i.test((v.depot||'').trim())||/^(test|qa)$/i.test((v.salesman_name||'').trim())));if(!xs.length){showToast('Tidak ada visit testing');return}if(!confirm(`Hapus ${xs.length} visit testing?`))return;for(const v of xs)await deleteVisitCascade(v.id,{silent:true});await refreshData({quiet:true});render();showToast('Cleanup selesai')}
async function saveAppSettings(form){const fd=Object.fromEntries(new FormData(form).entries()),photo={maxDimension:num(fd.maxDimension),quality:Number(fd.quality),maxPhotosPerCall:num(fd.maxPhotosPerCall)},rules={minDirectionalSample:num(fd.minDirectionalSample)};const [p,r]=await Promise.all([Cloud.updateAppSetting('photo_config',photo),Cloud.updateAppSetting('analysis_rules',rules)]);await Local.put('appSettings',p);await Local.put('appSettings',r);S.appSettings=S.appSettings.filter(x=>!['photo_config','analysis_rules'].includes(x.setting_key)).concat([p,r]);showToast('Settings tersimpan');render()}
async function toggleUser(id,nextActive){const p=await Cloud.updateProfile(id,{active:nextActive});await Local.put('profiles',p);const ix=S.profiles.findIndex(x=>x.id===id);if(ix>=0)S.profiles[ix]=p;render();showToast('User updated')}

async function handleClick(e){
  const b=e.target.closest('button,[data-route],[data-open-visit],[data-edit-visit],[data-edit-call],[data-confirm-recovery],[data-recovery-call],[data-call-method],[data-route-status],[data-result],[data-observed],[data-sfa],[data-remove-stock],[data-show-call],[data-admin-edit-call],[data-photo-call],[data-toggle-user],[data-admin-detail-mode],[data-admin-view-visit],[data-admin-delete-visit],[data-retry-queue]');if(!b)return;
  if(b.dataset.route){if(b.dataset.route==='field'){const v=activeVisit();if(v){S.selectedVisitId=v.id;await restoreDraft(v)}else{route('setup');return}}route(b.dataset.route);return}
  if(b.dataset.openVisit){S.selectedVisitId=b.dataset.openVisit;route('analysis');return}
  if(b.dataset.editVisit){root.innerHTML=shell(renderVisitSetup(b.dataset.editVisit));return}
  if(b.dataset.editCall){await editCall(b.dataset.editCall,b.dataset.visitId,{admin:false});return}
  if(b.dataset.adminEditCall){await editCall(b.dataset.adminEditCall,b.dataset.visitId,{admin:true});return}
  if(b.dataset.recoveryCall){S.selectedRecoveryCallId=b.dataset.recoveryCall;route('recovery');return}
  if(b.dataset.callMethod){if(b.dataset.callMethod==='WHATSAPP'&&!confirm('Order ini didapat tanpa kunjungan fisik?'))return;S.callDraft.call_method=b.dataset.callMethod;S.callDraft.route_status=b.dataset.callMethod==='WHATSAPP'?'REMOTE':'JKS';S.callDraft.result=b.dataset.callMethod==='WHATSAPP'?'EC':null;if(b.dataset.callMethod==='WHATSAPP')S.callDraft.call_timestamp=nowISO();await saveDraftLocal();render();return}
  if(b.dataset.routeStatus){captureInputs();S.callDraft.route_status=b.dataset.routeStatus;render();return}
  if(b.dataset.result){captureInputs();S.callDraft.result=b.dataset.result;if(S.callDraft.result!=='EC')S.callDraft.omzet=null;render();return}
  if(b.dataset.observed){captureInputs();S.callDraft.observed_reason_code=b.dataset.observed;if(b.dataset.observed!=='other')S.callDraft.custom_real_reason='';S.callDetailDraft=reasonDetailFor(S.callDraft.id)?structuredClone(reasonDetailFor(S.callDraft.id)):emptyReasonDetail(S.callDraft.id,S.callDraft.jovis_user_id);S.stockDraft=stockItemsFor(S.callDraft.id).map(x=>structuredClone(x));render();return}
  if(b.dataset.sfa){captureInputs();const legacy=normalizedCaptureType(S.callDraft)==='LEGACY';S.callDraft.sfa_reason_exact_code=b.dataset.sfa;if(!legacy){S.callDraft.sfa_reason_code=b.dataset.sfa;S.callDraft.sfa_capture_type='EXACT';S.callDraft.sfa_recovery_status='EXACT_CAPTURED'}else{S.callDraft.sfa_capture_type='LEGACY';S.callDraft.sfa_recovery_status='MANUAL_CONFIRMED'}S.callDraft.reason_match_status=dbCompatibleMatchStatus(S.callDraft);render();return}
  if(b.dataset.removeStock!==undefined){captureInputs();S.stockDraft.splice(Number(b.dataset.removeStock),1);saveDraftLocal();render();return}
  if(b.dataset.showCall){S.adminSelectedCallId=b.dataset.showCall;render();return}
  if(b.dataset.photoCall){await openCallPhotos(b.dataset.photoCall);return}
  if(b.dataset.toggleUser){await toggleUser(b.dataset.toggleUser,b.dataset.nextActive==='true');return}
  if(b.dataset.adminDetailMode){S.adminDetailMode=b.dataset.adminDetailMode;S.adminSelectedCallId=null;render();return}
  if(b.dataset.adminViewVisit){S.selectedVisitId=b.dataset.adminViewVisit;route('analysis');return}
  if(b.dataset.adminDeleteVisit){await deleteVisitCascade(b.dataset.adminDeleteVisit);S.adminDetailMode='visits';route('admin-detail');return}
  if(b.dataset.mapResult!==undefined){S.mapFilters.result=b.dataset.mapResult;render();return}
  if(b.dataset.mapReason!==undefined){S.mapFilters.reason=b.dataset.mapReason;render();return}
  if(b.dataset.retryQueue){await retryItem(b.dataset.retryQueue);await refreshData({quiet:true});await loadDiagnosticsData();render();return}
  if(b.dataset.confirmRecovery){await confirmLegacyRecovery(b.dataset.confirmRecovery);return}
  const a=b.dataset.action;if(!a)return;
  if(a==='lang'){S.lang=S.lang==='id'?'en':'id';await Local.setSetting('language',S.lang);render();return}
  if(a==='logout'){await Auth.signOut();location.reload();return}
  if(a==='checkInCall'){await checkInCurrentCall();return}
  if(a==='resetCallMethod'){if(S.callDraft?.checkin_at){showToast('Call sudah check-in, metode tidak bisa diubah.');return}S.callDraft.call_method=null;S.callDraft.route_status='JKS';S.callDraft.result=null;S.callDraft.call_timestamp=null;await saveDraftLocal();render();return}
  if(a==='nextActual'){captureInputs();if(!S.callDraft.outlet_name.trim()&&!S.callDraft.outlet_id.trim()){showToast('Isi outlet');return}S.callStage=1;await saveDraftLocal();render();return}
  if(a==='nextSfa'){captureInputs();if(!S.callDraft.observed_reason_code){showToast('Pilih alasan aktual');return}if(S.callDraft.observed_reason_code==='other'&&!S.callDraft.custom_real_reason.trim()){showToast(t('customOtherRequired'));return}if(!validateRichDetail())return;S.callStage=2;await saveDraftLocal();render();return}
  if(a==='prevStage'){captureInputs();S.callStage=Math.max(0,S.callStage-1);await saveDraftLocal();render();return}
  if(['saveEc','saveNonEc','saveWhatsapp'].includes(a)){await saveCall();return}
  if(a==='addStockItem'){captureInputs();S.stockDraft.push({id:uuid(),call_id:S.callDraft.id,jovis_user_id:S.callDraft.jovis_user_id,product_name:'',stock_level:null,qty_note:'',notes:''});await saveDraftLocal();render();return}
  if(a==='endVisit'){await endVisit();return}
  if(a==='refresh'){await refreshData();showToast('Data refreshed');return}
  if(a==='clearAdminFilters'){S.filters={date:'',jovis:'',depot:'',salesman:''};render();return}
  if(a==='clearDetailFilters'){S.detailFilters={date:'',jovis:'',depot:'',salesman:'',outletId:'',outletName:'',method:'',route:'',result:'',omzet:'',actual:'',sfa:'',recovery:'',duration:'',gps:'',evidence:'',photo:''};render();return}
  if(a==='sync'){await syncNow();await refreshData({quiet:true});render();return}
  if(a==='exportCurrent'){const v=S.selectedVisitId?S.visits.find(x=>x.id===S.selectedVisitId):null;const data=v?(()=>{const calls=visitCalls(v.id),ids=new Set(calls.map(c=>c.id));return{visits:[v],calls,reasonDetails:S.reasonDetails.filter(x=>ids.has(x.call_id)),stockItems:S.stockItems.filter(x=>ids.has(x.call_id)),recoveryAttempts:S.recoveryAttempts.filter(x=>ids.has(x.call_id)),photos:S.photos.filter(x=>ids.has(x.call_id))}})():filteredData();exportDetailedExcel(exportPayload(data));return}
  if(a==='exportAdmin'){exportDetailedExcel(exportPayload(filteredData()));return}
  if(a==='screenshotSummary'){await screenshotAdminSummary();return}
  if(a==='backupJson'){exportJsonBackup({schemaVersion:APP_VERSION,exportedAt:nowISO(),user:S.profile,profiles:S.profiles,visits:S.visits,calls:S.calls,reasonDetails:S.reasonDetails,stockItems:S.stockItems,recoveryAttempts:S.recoveryAttempts,photos:S.photos,taxonomy:S.taxonomy});return}
  if(a==='openDiagnostics'){route('settings');return}
  if(a==='runDiagnostics'){await runQaDiagnostics();return}
  if(a==='retryAllErrors'){await retryAllErrors();await refreshData({quiet:true});await loadDiagnosticsData();render();return}
  if(a==='purgeTestVisits'){await purgeTestVisits();return}
  if(a==='closeCallDetail'){S.adminSelectedCallId=null;render();return}
}

async function handleSubmit(e){
  if(e.target.id==='loginForm'){e.preventDefault();const fd=new FormData(e.target),err=document.getElementById('loginError');try{await Auth.signIn(fd.get('email'),fd.get('password'));S.session=await Auth.currentSession();S.user=S.session.user;await afterLogin()}catch(x){err.textContent=x.message;err.classList.remove('hidden')}return}
  if(e.target.id==='visitForm'){e.preventDefault();await submitVisit(e.target);return}
  if(e.target.id==='recoveryForm'){e.preventDefault();await saveRecoveryAttempt(e.target);return}
  if(e.target.id==='appSettingsForm'){e.preventDefault();await saveAppSettings(e.target);return}
}
async function handleChange(e){
  if(e.target.id==='languageSelect'){S.lang=e.target.value;await Local.setSetting('language',S.lang);render();return}
  if(e.target.dataset.adminFilter!==undefined){S.filters[e.target.dataset.adminFilter]=e.target.value;render();return}
  if(e.target.dataset.detailFilter!==undefined){S.detailFilters[e.target.dataset.detailFilter]=e.target.value;render();return}
  if(e.target.dataset.mapFilter!==undefined){S.mapFilters[e.target.dataset.mapFilter]=e.target.value;render();return}
  if(e.target.id==='photoInput'){await stagePhotos(e.target.files);return}
  captureInputs();
}

document.addEventListener('click',handleClick);
document.addEventListener('submit',handleSubmit);
document.addEventListener('change',handleChange);
document.addEventListener('input',e=>{if(e.target.id==='outletCodeDigits'){const clean=storeCodeDigits(e.target.value);if(e.target.value!==clean)e.target.value=clean}if(e.target.dataset.adminFilter!==undefined){S.filters[e.target.dataset.adminFilter]=e.target.value;return}if(e.target.dataset.detailFilter!==undefined){S.detailFilters[e.target.dataset.detailFilter]=e.target.value;return}if(['outletName','outletCodeDigits','omzet','customReason','evidence','sfaWhy','timing','quickNote'].includes(e.target.id)||e.target.dataset.rdField!==undefined||e.target.dataset.stockField!==undefined)captureInputs()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&safeToBackgroundPull())refreshData({quiet:false}).catch(()=>{})});
window.addEventListener('focus',()=>{if(safeToBackgroundPull())refreshData({quiet:false}).catch(()=>{})});

boot();
