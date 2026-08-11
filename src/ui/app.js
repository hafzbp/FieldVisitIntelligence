import { APP_NAME, APP_VERSION, I18N, DEFAULT_REASONS, FOLLOWUP_OPTIONS, FEATURE_FLAGS } from '../config/app-config.js';
import { isSupabaseConfigured } from '../data/supabase-client.js';
import * as Auth from '../auth/auth-service.js';
import * as Local from '../data/local-db.js';
import * as Cloud from '../data/cloud-repository.js';
import { enqueue, syncNow, onSyncStatus, queueDiagnostics, retryItem, retryAllErrors } from '../data/sync-engine.js';
import { analyze, buildFindings, observedLabel, sfaLabel } from '../domain/analysis-engine.js';
import { classifyReason } from '../domain/reason-engine.js';
import { exportDetailedExcel, exportJsonBackup } from '../export/exporter.js';
import { nowISO, today, fmtCurrency, fmtDate, fmtTime, esc, num, pct, normalize } from '../config/utils.js';

const root=document.getElementById('root'),toastEl=document.getElementById('toast');
const S={session:null,user:null,profile:null,profiles:[],visits:[],calls:[],taxonomy:[],reasonMappings:[],lang:'id',route:'home',selectedVisitId:null,callDraft:null,callStage:0,editingCallId:null,geoBusy:false,geoError:'',sync:{online:navigator.onLine,pending:0,errors:0,syncing:false},queueItems:[],diagnostics:null,filters:{date:'',jovis:'',depot:''},adminTimer:null,backgroundTimer:null,pulling:false};
const t=k=>I18N[S.lang]?.[k]||I18N.id[k]||k;
const isAdmin=()=>S.profile?.role==='admin';
const myVisits=()=>S.visits.filter(v=>v.jovis_user_id===S.user?.id&&!v.is_deleted);
const activeVisit=()=>myVisits().find(v=>v.status==='active')||null;
const visitCalls=id=>S.calls.filter(c=>c.visit_id===id&&!c.is_deleted).sort((a,b)=>String(a.call_timestamp||'').localeCompare(String(b.call_timestamp||'')));
const profileName=id=>S.profiles.find(p=>p.id===id)?.display_name||S.profiles.find(p=>p.id===id)?.email||id?.slice(0,8)||'-';
const taxonomyLabel=(code,lang=S.lang)=>{const r=S.taxonomy.find(x=>x.reason_code===code);return r?(lang==='id'?r.reason_label_id:r.reason_label_en):code||'-'};
const showToast=msg=>{toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(showToast._t);showToast._t=setTimeout(()=>toastEl.classList.remove('show'),1900)};
const uuid=()=>crypto.randomUUID();
const storeCodeDigits=value=>String(value||'').replace(/[^0-9]/g,'');
const canonicalStoreCode=value=>{const digits=storeCodeDigits(value);return digits?`C${digits}`:''};
const durationSeconds=(start,end)=>{const a=Date.parse(start||''),b=Date.parse(end||'');return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,Math.round((b-a)/1000)):null};
const fmtDuration=s=>{if(s===null||s===undefined||!Number.isFinite(Number(s)))return '-';const n=Math.max(0,Number(s)),m=Math.floor(n/60),sec=Math.floor(n%60);return m?`${m}m ${String(sec).padStart(2,'0')}s`:`${sec}s`};

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}
onSyncStatus(s=>{S.sync=s;renderTopbar();});

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
    route(isAdmin()?'admin':'home');
    startBackgroundPull();
  }catch(e){renderError(e)}
}

async function reconcileQueueWithTombstones(data){
  const tombstoneVisits=new Set((data.visits||[]).filter(v=>v.is_deleted).map(v=>v.id));
  const tombstoneCalls=new Set((data.calls||[]).filter(c=>c.is_deleted).map(c=>c.id));
  const queue=await Local.all('queue');
  for(const item of queue){
    const staleVisit=item.entity==='visit'&&tombstoneVisits.has(item.payload?.id)&&item.payload?.is_deleted!==true;
    const staleCall=item.entity==='call'&&tombstoneCalls.has(item.payload?.id)&&item.payload?.is_deleted!==true;
    if(staleVisit||staleCall) await Local.del('queue',item.id);
  }
}

async function reconcileDeletedLocalState(){
  const deletedVisitIds=new Set(S.visits.filter(v=>v.is_deleted).map(v=>v.id));
  for(const visitId of deletedVisitIds) await Local.del('drafts',`call:${visitId}`);
  if(S.callDraft?.visit_id&&deletedVisitIds.has(S.callDraft.visit_id)){
    S.callDraft=null;S.callStage=0;S.editingCallId=null;S.geoBusy=false;S.geoError='';
  }
  if(S.selectedVisitId&&deletedVisitIds.has(S.selectedVisitId)) S.selectedVisitId=null;
}

async function refreshData({quiet=false}={}){
  if(S.pulling)return;
  S.pulling=true;
  try{
    if(navigator.onLine){
      await syncNow();
      try{
        const data=await Cloud.fetchDataset();
        await reconcileQueueWithTombstones(data);
        const pending=await Local.all('queue');const pendingVisit=new Set(pending.filter(q=>q.entity==='visit').map(q=>q.payload?.id));const pendingCall=new Set(pending.filter(q=>q.entity==='call').map(q=>q.payload?.id));
        const cloudVisits=data.visits.filter(v=>v.is_deleted||!pendingVisit.has(v.id));
        const cloudCalls=data.calls.filter(c=>c.is_deleted||!pendingCall.has(c.id));
        await Local.cacheDataset({profiles:data.profiles,visits:cloudVisits,calls:cloudCalls,taxonomy:data.taxonomy});
        S.reasonMappings=data.reasonMappings||[];
      }catch(e){if(!quiet)showToast(`Cloud refresh: ${e.message}`)}
    }
    S.profiles=await Local.all('profiles');S.visits=await Local.all('visits');S.calls=await Local.all('calls');S.taxonomy=await Local.all('taxonomy');
    await reconcileDeletedLocalState();
    if(!S.taxonomy.length) S.taxonomy=DEFAULT_REASONS.map((r,i)=>({reason_code:r.code,reason_label_id:r.id,reason_label_en:r.en,reason_type:r.type,active:true,sort_order:i+1}));
    S.profile=S.profiles.find(p=>p.id===S.user.id)||S.profile;
    if(!quiet)render();
  }finally{S.pulling=false}
}

function safeToBackgroundPull(){return !!S.user&&navigator.onLine&&!['field','setup'].includes(S.route)&&!S.pulling}
function startBackgroundPull(){
  if(S.backgroundTimer)clearInterval(S.backgroundTimer);
  const ms=Math.max(15,FEATURE_FLAGS.backgroundPullSeconds||60)*1000;
  S.backgroundTimer=setInterval(()=>{if(safeToBackgroundPull())refreshData({quiet:false}).catch(()=>{})},ms);
}

function shell(content,{nav=true}={}){
  return `<div class="app"><header class="topbar"><img class="logo" src="assets/nabati-logo.png" alt="Nabati"><div class="brand"><b>${APP_NAME}</b><small>EC/SC 90% · v${APP_VERSION}</small></div><div class="spacer"></div><span id="syncBadge">${syncBadge()}</span><button class="btn btn-secondary" style="min-height:34px;padding:6px 8px" data-action="lang">${S.lang==='id'?'EN':'ID'}</button></header><main>${content}</main>${nav?bottomNav():''}</div>`;
}
function syncBadge(){const cls=S.sync.syncing?'blue':!S.sync.online?'warn':S.sync.errors?'bad':S.sync.pending?'warn':'good';const label=S.sync.syncing?t('syncing'):!S.sync.online?`${t('offline')} · ${S.sync.pending}`:S.sync.errors?`${t('syncError')} · ${S.sync.errors}`:S.sync.pending?`${S.sync.pending} ${t('pending')}`:t('synced');return `<button type="button" class="pill ${cls} sync-badge-btn" data-action="openDiagnostics" title="${S.lang==='id'?'Buka status sinkronisasi':'Open sync status'}"><i class="sync-dot"></i>${label}</button>`}
function renderTopbar(){const el=document.getElementById('syncBadge');if(el)el.innerHTML=syncBadge()}
function navIcon(name){const icons={home:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5.5 9.5V20h13V9.5"></path></svg>`,field:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>`,analysis:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9"></path><path d="M10 19V5"></path><path d="M16 19v-8"></path><path d="M22 19V3"></path></svg>`,admin:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 4v10l-7 4-7-4V7l7-4Z"></path><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>`,settings:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"></circle><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z"></path></svg>`};return icons[name]||icons.home}
function bottomNav(){const items=[['home','home',t('home')],['field','field',t('field')],['analysis','analysis',t('analysis')],...(isAdmin()?[['admin','admin',t('admin')]]:[]),['settings','settings',t('settings')]];return `<nav class="bottom-nav" style="--nav-count:${items.length}">${items.map(([r,i,l])=>`<button class="nav ${S.route===r?'active':''}" data-route="${r}"><span class="nav-icon">${navIcon(i)}</span><span class="nav-label">${l}</span></button>`).join('')}</nav>`}
function route(r,payload={}){if(S.adminTimer){clearInterval(S.adminTimer);S.adminTimer=null}S.route=r;if(payload.visitId)S.selectedVisitId=payload.visitId;if(r==='field'&&!S.callDraft)resetCallDraft();render();if(r==='settings')loadDiagnosticsData().then(()=>{if(S.route==='settings')render()}).catch(()=>{})}
function render(){
  if(!S.user){renderLogin();return}
  let content='';
  if(S.route==='home')content=renderHome();
  else if(S.route==='setup')content=renderVisitSetup();
  else if(S.route==='field')content=renderField();
  else if(S.route==='analysis')content=renderAnalysis();
  else if(S.route==='admin')content=renderAdmin();
  else if(S.route==='settings')content=renderSettings();
  root.innerHTML=shell(content);
}

function renderConnectionRequired(){root.innerHTML=`<div class="login-shell"><div class="card login-card"><div class="login-brand"><img class="login-logo" src="assets/nabati-logo.png"><h1>${APP_NAME}</h1><p>EC/SC 90% · Supabase Setup</p></div><span class="pill warn">SETUP REQUIRED</span><h1 style="margin-top:12px">${t('connectRequired')}</h1><p class="muted">${t('connectHelp')}</p><div class="notice"><b>Yang dibutuhkan:</b><br>1. Supabase Project URL<br>2. Supabase Publishable Key <code>sb_publishable_...</code><br><br>Jangan masukkan secret/service_role key ke GitHub.</div><p class="small muted" style="margin-top:12px">Buka <code>docs/SETUP_SUPABASE_BEGINNER.md</code> di package ini untuk langkah klik-per-klik.</p></div></div>`}
function renderLogin(){root.innerHTML=`<div class="login-shell"><form id="loginForm" class="card login-card"><div class="login-brand"><img class="login-logo" src="assets/nabati-logo.png"><h1>${APP_NAME}</h1><p>EC/SC 90% · Non-EC Validation</p></div><h1>${t('login')}</h1><p class="muted small">Login menggunakan akun Admin/JOVIS yang dibuat di Supabase Auth.</p><div class="field"><label>${t('email')}</label><input class="input" name="email" type="email" autocomplete="username" required></div><div class="field"><label>${t('password')}</label><input class="input" name="password" type="password" autocomplete="current-password" required></div><button class="btn btn-primary btn-block">${t('login')}</button><div id="loginError" class="notice bad hidden" style="margin-top:10px"></div></form></div>`}
function renderProfileMissing(){root.innerHTML=shell(`<div class="card"><h1>Profile belum tersedia</h1><p class="muted">Akun Auth berhasil login, tetapi row <code>profiles</code> belum ditemukan. Jalankan migration SQL dan pastikan profile untuk user ini tersedia.</p><button class="btn btn-danger" data-action="logout">${t('logout')}</button></div>`,{nav:false})}
function renderInactive(){root.innerHTML=shell(`<div class="card"><h1>Akun nonaktif</h1><p class="muted">Hubungi Admin untuk mengaktifkan akun JOVIS ini.</p><button class="btn btn-danger" data-action="logout">${t('logout')}</button></div>`,{nav:false})}
function renderError(e){root.innerHTML=`<div class="login-shell"><div class="card login-card"><h1>Application Error</h1><div class="notice bad">${esc(e?.message||String(e))}</div><button class="btn btn-secondary btn-block" onclick="location.reload()" style="margin-top:10px">Reload</button></div></div>`}

function visitStats(v){const cs=visitCalls(v.id),ec=cs.filter(c=>c.result==='EC');return{sc:cs.length,ec:ec.length,ne:cs.length-ec.length,ecsc:pct(ec.length,cs.length),revenue:ec.reduce((s,c)=>s+num(c.omzet),0)}}
function dwellStats(calls){const valid=calls.map(c=>Number(c.duration_seconds)).filter(x=>Number.isFinite(x)&&x>=0);const ec=calls.filter(c=>c.result==='EC').map(c=>Number(c.duration_seconds)).filter(x=>Number.isFinite(x)&&x>=0);const ne=calls.filter(c=>c.result==='NON_EC').map(c=>Number(c.duration_seconds)).filter(x=>Number.isFinite(x)&&x>=0);const avg=a=>a.length?Math.round(a.reduce((s,x)=>s+x,0)/a.length):null;return{n:valid.length,avg:avg(valid),avgEc:avg(ec),avgNonEc:avg(ne)}}
function renderHome(){const av=activeVisit(),vis=[...myVisits()].sort((a,b)=>String(b.start_time).localeCompare(String(a.start_time))).slice(0,12);return `<div class="card hero"><span class="pill ${isAdmin()?'blue':'good'}">${isAdmin()?t('roleAdmin'):t('roleJovis')} · ${esc(S.profile.display_name||S.user.email)}</span><h1 style="margin-top:10px">${S.lang==='id'?'Field Visit Hari Ini':'Today\'s Field Visit'}</h1><p class="muted">${S.lang==='id'?'Setiap call disimpan lokal terlebih dahulu lalu disinkronkan ke Supabase.':'Every call is stored locally first, then synchronized to Supabase.'}</p>${av?`<button class="btn btn-primary btn-block" data-route="field">${t('resume')} · ${visitCalls(av.id).length} SC</button>`:`<button class="btn btn-primary btn-block" data-route="setup">+ ${t('startVisit')}</button>`}</div><div class="card"><div class="section-head"><h2>${t('myVisits')}</h2><span class="small muted">${vis.length}</span></div>${vis.length?`<div class="list">${vis.map(visitCard).join('')}</div>`:`<div class="empty">${t('noData')}</div>`}</div>`}
function visitCard(v){const z=visitStats(v);return `<div class="list-card"><div class="list-top"><div><div class="list-title">${esc(v.depot)} · ${esc(v.salesman_name)}</div><div class="meta">${fmtDate(v.visit_date)} · ${fmtTime(v.start_time)} · ${profileName(v.jovis_user_id)}</div></div><span class="pill ${v.status==='active'?'blue':'good'}">${v.status==='active'?t('active'):t('completed')}</span></div><div class="metrics"><span class="metric">SC ${z.sc}</span><span class="metric">EC ${z.ec}</span><span class="metric">EC/SC ${z.ecsc}%</span><span class="metric">${fmtCurrency(z.revenue)}</span></div><div class="btn-row" style="margin-top:9px"><button class="btn btn-secondary" data-open-visit="${v.id}">${t('analysis')}</button>${v.jovis_user_id===S.user.id?`<button class="btn btn-secondary" data-edit-visit="${v.id}">${t('edit')}</button>`:''}${isAdmin()?`<button class="btn btn-danger" data-delete-visit="${v.id}">${t('delete')}</button>`:''}</div></div>`}

function renderVisitSetup(editId=null){const v=editId?S.visits.find(x=>x.id===editId):null;return `<div class="card"><h1>${v?(S.lang==='id'?'Edit Visit':'Edit Visit'):t('startVisit')}</h1><p class="muted small">${v?t('editCompleted'):(S.lang==='id'?'Start time dicapture otomatis saat visit dimulai.':'Start time is captured automatically.')}</p><form id="visitForm" data-edit-id="${v?.id||''}"><div class="grid2"><div class="field"><label>${t('date')}</label><input class="input" type="date" name="visit_date" value="${v?.visit_date||today()}" required></div><div class="field"><label>${t('depot')}</label><input class="input" name="depot" value="${esc(v?.depot||'')}" required></div><div class="field"><label>${t('salesman')}</label><input class="input" name="salesman_name" value="${esc(v?.salesman_name||'')}" required></div><div class="field"><label>${t('salesmanId')}</label><input class="input" name="salesman_id" value="${esc(v?.salesman_id||'')}"></div></div><div class="field"><label>${t('notes')}</label><textarea class="textarea" name="notes">${esc(v?.notes||'')}</textarea></div><button class="btn btn-primary btn-block">${v?(S.lang==='id'?'Simpan Perubahan':'Save Changes'):t('startVisit')}</button></form></div>`}

function newCallDraft(){return {id:uuid(),visit_id:activeVisit()?.id||S.selectedVisitId||null,jovis_user_id:S.user.id,outlet_id:'',outlet_name:'',route_status:'JKS',result:null,call_timestamp:null,checkin_at:null,checkout_at:null,checkin_latitude:null,checkin_longitude:null,checkin_accuracy_m:null,checkout_latitude:null,checkout_longitude:null,checkout_accuracy_m:null,duration_seconds:null,omzet:null,observed_reason_code:null,custom_real_reason:'',contributing_factor:null,evidence:'',sfa_reason_code:null,reason_match_status:null,sfa_selection_reason:'',revisit_plan:null,can_revisit_earlier:null,followup_timing_reason:'',quick_note:'',client_created_at:nowISO(),client_updated_at:nowISO(),created_at:null,updated_at:null,is_deleted:false}}
function resetCallDraft(){S.callDraft=newCallDraft();S.callStage=0;S.editingCallId=null;S.geoError='';S.geoBusy=false;saveDraftLocal()}
async function saveDraftLocal(){const v=activeVisit()||S.visits.find(x=>x.id===S.callDraft?.visit_id);if(!v||!S.callDraft)return;await Local.put('drafts',{id:`call:${v.id}`,visit_id:v.id,call:S.callDraft,stage:S.callStage,editingCallId:S.editingCallId,saved_at:nowISO()})}
async function restoreDraft(v){const d=await Local.get('drafts',`call:${v.id}`);if(d){S.callDraft=d.call;S.callStage=d.stage||0;S.editingCallId=d.editingCallId||null;S.geoError='';S.geoBusy=false}else resetCallDraft()}

function geoErrorMessage(err){
  const code=err?.code;
  if(code===1)return S.lang==='id'?'Permission lokasi wajib diaktifkan untuk melakukan check-in call. Izinkan akses lokasi di browser lalu coba lagi.':'Location permission is required to check in. Allow browser location access, then try again.';
  if(code===2)return S.lang==='id'?'Lokasi perangkat tidak dapat ditentukan. Pastikan Location/GPS aktif lalu coba lagi.':'Device location is unavailable. Turn on Location/GPS and try again.';
  if(code===3)return S.lang==='id'?'Pengambilan lokasi timeout. Coba lagi di area dengan sinyal GPS yang lebih baik.':'Location request timed out. Try again with better GPS signal.';
  return S.lang==='id'?'Browser tidak dapat mengambil lokasi. Location permission dan GPS wajib aktif.':'The browser could not get your location. Location permission and GPS must be enabled.';
}
function getRequiredPosition(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation){reject(Object.assign(new Error('Geolocation unavailable'),{code:0}));return}
    navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:20000,maximumAge:0});
  });
}
async function checkInCurrentCall(){
  if(S.editingCallId)return;
  const d=S.callDraft||newCallDraft();
  if(d.checkin_at)return;
  const requestedAt=nowISO();
  S.geoBusy=true;S.geoError='';render();
  try{
    const pos=await getRequiredPosition();
    d.checkin_at=requestedAt;d.call_timestamp=requestedAt;
    d.checkin_latitude=pos.coords.latitude;d.checkin_longitude=pos.coords.longitude;d.checkin_accuracy_m=pos.coords.accuracy;
    d.client_updated_at=nowISO();S.callDraft=d;await saveDraftLocal();
    S.geoBusy=false;S.geoError='';render();
    showToast(S.lang==='id'?`Check-in berhasil · akurasi ±${Math.round(pos.coords.accuracy)} m`:`Checked in · accuracy ±${Math.round(pos.coords.accuracy)} m`);
  }catch(err){S.geoBusy=false;S.geoError=geoErrorMessage(err);render()}
}
async function captureCheckoutLocation(){
  const requestedAt=nowISO();
  S.geoBusy=true;S.geoError='';render();
  try{
    const pos=await getRequiredPosition();
    const d=S.callDraft;
    d.checkout_at=requestedAt;d.checkout_latitude=pos.coords.latitude;d.checkout_longitude=pos.coords.longitude;d.checkout_accuracy_m=pos.coords.accuracy;
    d.duration_seconds=durationSeconds(d.checkin_at,d.checkout_at);d.client_updated_at=nowISO();
    S.geoBusy=false;S.geoError='';return true;
  }catch(err){S.geoBusy=false;S.geoError=geoErrorMessage(err);render();return false}
}

function renderField(){const v=activeVisit()||S.visits.find(x=>x.id===S.callDraft?.visit_id&&!x.is_deleted);if(!v)return `<div class="card"><h1>${t('field')}</h1><p class="muted">${S.lang==='id'?'Tidak ada visit aktif.':'No active visit.'}</p><button class="btn btn-primary" data-route="setup">${t('startVisit')}</button></div>`;if(!S.callDraft)S.callDraft=newCallDraft();const cs=visitCalls(v.id),z=visitStats(v);const checkedIn=!!S.callDraft.checkin_at||!!S.editingCallId;return `<div class="two-col"><section><div class="card"><div class="call-header"><div class="num">${S.editingCallId?'✎':cs.length+1}</div><div class="info"><h2 style="margin:0">${esc(v.depot)} · ${esc(v.salesman_name)}</h2><div class="meta">Start ${fmtTime(v.start_time)} · SC ${z.sc} · EC ${z.ec} · EC/SC ${z.ecsc}%</div></div></div>${checkedIn?renderCallStage():renderCheckinGate(cs.length+1)}</div></section><aside><div class="card"><div class="section-head"><h2>${S.lang==='id'?'Call Terakhir':'Recent Calls'}</h2><span class="pill blue">${cs.length}</span></div>${cs.slice(-8).reverse().map(c=>`<div class="reason-card"><div class="list-top"><div><b>#${cs.indexOf(c)+1} · ${esc(c.outlet_name)}</b><div class="meta">${fmtTime(c.checkin_at||c.call_timestamp)} · ${c.result}${c.result==='EC'?` · ${fmtCurrency(c.omzet)}`:` · ${esc(observedLabel(c,S.taxonomy,S.lang))}`}${c.duration_seconds!==null&&c.duration_seconds!==undefined?` · ${fmtDuration(c.duration_seconds)}`:''}</div></div><button class="btn btn-secondary" data-edit-call="${c.id}" data-visit-id="${v.id}">${t('edit')}</button></div></div>`).join('')||`<div class="empty">${t('noData')}</div>`}<hr><button class="btn btn-danger btn-block" data-action="endVisit">${t('endVisit')}</button></div></aside></div>`}
function renderCheckinGate(callNo){return `<div class="checkin-gate"><span class="pill blue">${S.lang==='id'?'CALL BERIKUTNYA':'NEXT CALL'}</span><div class="checkin-number">#${callNo}</div><h2>${S.lang==='id'?'Check-in sebelum mulai input call':'Check in before entering call data'}</h2><p class="muted small">${S.lang==='id'?'Tombol ini akan meminta permission lokasi browser. Form call tidak dapat dibuka sebelum timestamp dan koordinat check-in berhasil tercatat.':'This button requests browser location permission. The call form stays locked until check-in time and coordinates are captured.'}</p>${S.geoError?`<div class="notice bad" style="margin-bottom:10px">${esc(S.geoError)}</div>`:''}<button class="btn btn-primary btn-block" data-action="checkInCall" ${S.geoBusy?'disabled':''}>${S.geoBusy?(S.lang==='id'?'Mengambil Lokasi...':'Getting Location...'):(S.lang==='id'?`CHECK IN CALL #${callNo}`:`CHECK IN CALL #${callNo}`)}</button><div class="meta" style="margin-top:9px">${S.lang==='id'?'Location/GPS wajib aktif. Jika permission ditolak, call tidak bisa dilanjutkan.':'Location/GPS is mandatory. If permission is denied, the call cannot continue.'}</div></div>`}
function reasonChips(selected,attr,type='observed'){return S.taxonomy.filter(r=>r.active&&(r.reason_type==='both'||r.reason_type===type)).map(r=>`<button type="button" class="chip ${selected===r.reason_code?'selected':''}" data-${attr}="${r.reason_code}">${esc(S.lang==='id'?r.reason_label_id:r.reason_label_en)}</button>`).join('')}
function renderCallStage(){const d=S.callDraft||newCallDraft();const codeDigits=storeCodeDigits(d.outlet_id);const checkinInfo=d.checkin_at?`<div class="notice good" style="margin-bottom:12px"><b>${S.editingCallId?(S.lang==='id'?'Data Check-in Call':'Call Check-in Data'):(S.lang==='id'?'Checked-in':'Checked in')}</b> · ${fmtTime(d.checkin_at)}${d.checkin_accuracy_m!==null&&d.checkin_accuracy_m!==undefined?` · GPS ±${Math.round(d.checkin_accuracy_m)} m`:''}${d.duration_seconds!==null&&d.duration_seconds!==undefined?` · ${fmtDuration(d.duration_seconds)}`:''}</div>`:'';if(S.callStage===0)return `${checkinInfo}<div class="field"><label>${t('outlet')}</label><input id="outletName" class="input" value="${esc(d.outlet_name)}" placeholder="Nama toko" required></div><div class="grid2"><div class="field"><label>${t('outletId')}</label><div class="store-code-wrap"><span class="store-code-prefix">C</span><input id="outletCodeDigits" class="input store-code-input" inputmode="numeric" pattern="[0-9]*" value="${esc(codeDigits)}" placeholder="9899421"></div><div class="meta">${S.lang==='id'?'Huruf C otomatis. Input angka tanpa spasi.':'C is automatic. Enter digits only, without spaces.'}</div></div><div class="field"><label>${t('route')}</label><div class="btn-row"><button type="button" class="btn ${d.route_status==='JKS'?'btn-primary':'btn-secondary'}" data-route-status="JKS">JKS</button><button type="button" class="btn ${d.route_status==='OFF_ROUTE'?'btn-primary':'btn-secondary'}" data-route-status="OFF_ROUTE">OFF ROUTE</button></div></div></div><div class="field"><label>${t('result')}</label><div class="result-grid"><button type="button" class="result-btn ec ${d.result==='EC'?'selected':''}" data-result="EC">EC</button><button type="button" class="result-btn ne ${d.result==='NON_EC'?'selected':''}" data-result="NON_EC">NON-EC</button></div></div>${d.result==='EC'?`<div class="field"><label>${t('omzet')} *</label><input id="omzet" class="input" inputmode="numeric" type="number" min="0" value="${d.omzet??''}" required></div>${S.geoError?`<div class="notice bad" style="margin-bottom:10px">${esc(S.geoError)}</div>`:''}<div class="sticky-actions"><button class="btn btn-primary btn-block" data-action="saveEc" ${S.geoBusy?'disabled':''}>${S.editingCallId?(S.lang==='id'?'Update EC':'Update EC'):(S.geoBusy?(S.lang==='id'?'Mengambil Lokasi Checkout...':'Getting Checkout Location...'):(S.lang==='id'?'Simpan & ke Call Berikutnya':'Save & Next Call'))}</button></div>`:''}${d.result==='NON_EC'?`<div class="sticky-actions"><button class="btn btn-primary btn-block" data-action="nextActual">${S.lang==='id'?'Lanjut: Alasan Riil':'Continue: Actual Reason'}</button></div>`:''}`;
  if(S.callStage===1)return `${checkinInfo}<span class="pill blue">1 / 2 · ${t('observedReason')}</span><h2 style="margin-top:10px">${S.lang==='id'?'Apa alasan riil toko tidak EC?':'What actually caused the Non-EC?'}</h2><p class="muted small">${S.lang==='id'?'Catat kondisi aktual sebelum melihat reason yang dipilih salesman di SFA.':'Capture the actual condition before checking the SFA reason.'}</p><div class="chips">${reasonChips(d.observed_reason_code,'observed','observed')}</div>${d.observed_reason_code==='other'?`<div class="field" style="margin-top:12px"><label>${t('customReason')} *</label><input id="customReason" class="input" value="${esc(d.custom_real_reason)}" placeholder="Contoh: Produk existing slow moving"></div>`:''}<div class="field" style="margin-top:12px"><label>${t('factor')} (optional)</label><select id="factor" class="select"><option value="">-</option>${S.taxonomy.filter(r=>r.reason_code!==d.observed_reason_code&&!['unclear','other'].includes(r.reason_code)).map(r=>`<option value="${r.reason_code}" ${d.contributing_factor===r.reason_code?'selected':''}>${esc(S.lang==='id'?r.reason_label_id:r.reason_label_en)}</option>`).join('')}</select></div><div class="field"><label>${t('evidence')}</label><textarea id="evidence" class="textarea" placeholder="Fakta/ucapan yang diamati">${esc(d.evidence)}</textarea></div><div class="btn-row"><button class="btn btn-secondary" data-action="prevStage">←</button><button class="btn btn-primary" data-action="nextSfa">${S.lang==='id'?'Lanjut ke SFA':'Continue to SFA'}</button></div>`;
  return `${checkinInfo}<span class="pill blue">2 / 2 · ${t('sfaReason')}</span><h2 style="margin-top:10px">${S.lang==='id'?'Reason apa yang dipilih salesman di SFA?':'What reason did the salesman select in SFA?'}</h2><div class="chips">${reasonChips(d.sfa_reason_code,'sfa','sfa')}</div>${d.sfa_reason_code?`<div class="notice ${classifyReason(d)==='MATCH'?'good':classifyReason(d)==='MISMATCH'?'bad':''}" style="margin-top:12px"><b>${classifyReason(d)}</b> · ${esc(observedLabel(d,S.taxonomy,S.lang))} → ${esc(sfaLabel(d,S.taxonomy,S.lang))}</div>`:''}<div class="field" style="margin-top:12px"><label>${S.lang==='id'?'Kenapa reason SFA itu dipilih?':'Why was that SFA reason selected?'}</label><input id="sfaWhy" class="input" value="${esc(d.sfa_selection_reason)}" placeholder="Optional / jika diketahui"></div><div class="grid2"><div class="field"><label>${t('revisit')}</label><select id="revisit" class="select"><option value="">-</option>${FOLLOWUP_OPTIONS.map(([k,l])=>`<option value="${k}" ${d.revisit_plan===k?'selected':''}>${l}</option>`).join('')}</select></div><div class="field"><label>${t('earlier')}</label><select id="earlier" class="select"><option value="">-</option><option value="YES" ${d.can_revisit_earlier==='YES'?'selected':''}>YA</option><option value="NO" ${d.can_revisit_earlier==='NO'?'selected':''}>TIDAK</option><option value="UNKNOWN" ${d.can_revisit_earlier==='UNKNOWN'?'selected':''}>TIDAK TAHU</option></select></div></div><div class="field"><label>${t('timing')}</label><textarea id="timing" class="textarea" placeholder="JKS, permintaan PIC, stock belum habis, jarak, workload, info toko, dll.">${esc(d.followup_timing_reason)}</textarea></div><div class="field"><label>Quick Note</label><textarea id="quickNote" class="textarea">${esc(d.quick_note)}</textarea></div>${S.geoError?`<div class="notice bad" style="margin-bottom:10px">${esc(S.geoError)}</div>`:''}<div class="btn-row"><button class="btn btn-secondary" data-action="prevStage">←</button><button class="btn btn-primary" data-action="saveNonEc" ${S.geoBusy?'disabled':''}>${S.editingCallId?(S.lang==='id'?'Update Non-EC':'Update Non-EC'):(S.geoBusy?(S.lang==='id'?'Mengambil Lokasi Checkout...':'Getting Checkout Location...'):(S.lang==='id'?'Simpan & ke Call Berikutnya':'Save & Next Call'))}</button></div>`}

function filteredData(scope='analysis'){
  let visits=isAdmin()?S.visits.filter(v=>!v.is_deleted):myVisits();
  if(S.filters.date)visits=visits.filter(v=>v.visit_date===S.filters.date);if(S.filters.jovis)visits=visits.filter(v=>v.jovis_user_id===S.filters.jovis);if(S.filters.depot)visits=visits.filter(v=>v.depot===S.filters.depot);
  const ids=new Set(visits.map(v=>v.id));return {visits,calls:S.calls.filter(c=>ids.has(c.visit_id)&&!c.is_deleted)}
}
function renderAnalysis(){const v=S.selectedVisitId?S.visits.find(x=>x.id===S.selectedVisitId&&!x.is_deleted):null;const data=v?{visits:[v],calls:visitCalls(v.id)}:filteredData();const a=analyze(data.visits,data.calls,S.taxonomy,S.lang),findings=buildFindings(a,S.taxonomy,S.lang),dwell=dwellStats(data.calls);return `<div class="card"><div class="section-head"><div><h1>${v?`${esc(v.depot)} · ${esc(v.salesman_name)}`:t('analysis')}</h1><div class="meta">${v?`${fmtDate(v.visit_date)} · ${profileName(v.jovis_user_id)}`:(S.lang==='id'?'Dataset sesuai akses akun':'Dataset based on account access')}</div></div><button class="btn btn-secondary" data-action="exportCurrent">${t('exportDetail')}</button></div><div class="kpis"><div class="kpi"><b>${a.sc}</b><span>${t('sc')}</span></div><div class="kpi"><b>${a.ec}</b><span>${t('ec')}</span></div><div class="kpi"><b>${a.ecsc}%</b><span>${t('ecsc')}</span></div><div class="kpi"><b>${fmtCurrency(a.totalRevenue)}</b><span>${t('revenue')}</span></div><div class="kpi"><b>${a.status.MATCH}</b><span>${t('match')}</span></div><div class="kpi"><b>${a.status.MISMATCH}</b><span>${t('mismatch')}</span></div><div class="kpi"><b>${Object.values(a.customReasons).reduce((s,x)=>s+x.count,0)}</b><span>${t('unmapped')}</span></div><div class="kpi"><b>${a.ne}</b><span>${t('nonEc')}</span></div><div class="kpi"><b>${fmtDuration(dwell.avg)}</b><span>${S.lang==='id'?'Avg Waktu / Call':'Avg Time / Call'}</span></div><div class="kpi"><b>${fmtDuration(dwell.avgEc)}</b><span>${S.lang==='id'?'Avg Waktu EC':'Avg EC Time'}</span></div><div class="kpi"><b>${fmtDuration(dwell.avgNonEc)}</b><span>${S.lang==='id'?'Avg Waktu Non-EC':'Avg Non-EC Time'}</span></div></div></div><div class="card"><h2>${S.lang==='id'?'Rule-based Findings':'Rule-based Findings'}</h2>${findings.length?findings.map(f=>`<div class="finding"><b>${esc(f.title)}</b><span>${esc(f.text)}</span></div>`).join(''):`<div class="empty">${t('noData')}</div>`}</div>${renderReasonAccuracy(a)}${renderUnmapped(a,data)}${renderCallTable(data,v)}`}
function renderReasonAccuracy(a){const okeys=Object.keys(a.observedCounts),skeys=Object.keys(a.sfaCounts);return `<div class="card"><h2>${S.lang==='id'?'Akurasi & Mismatch Reason':'Reason Accuracy & Mismatch'}</h2><div class="table-wrap"><table class="table"><thead><tr><th>SFA Reason</th><th>N</th><th>Match</th><th>Partial</th><th>Mismatch</th><th>Unclear</th><th>Mismatch %</th></tr></thead><tbody>${Object.entries(a.bySfa).map(([k,x])=>`<tr><td>${esc(taxonomyLabel(k))}</td><td>${x.n}</td><td>${x.MATCH}</td><td>${x.PARTIAL}</td><td>${x.MISMATCH}</td><td>${x.UNCLEAR}</td><td>${x.mismatchRate}%</td></tr>`).join('')}</tbody></table></div><h3 style="margin-top:14px">Mismatch Matrix</h3><div class="table-wrap"><table class="table matrix"><thead><tr><th>SFA \ Actual</th>${okeys.map(k=>`<th>${esc(a.observedLabels[k]||k)}</th>`).join('')}</tr></thead><tbody>${skeys.map(s=>`<tr><th>${esc(taxonomyLabel(s))}</th>${okeys.map(o=>`<td class="${s===o?'diag':(a.matrix[s]?.[o]?'hot':'')}">${a.matrix[s]?.[o]||0}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`}
function renderUnmapped(a,data){const rows=Object.values(a.customReasons).sort((x,y)=>y.count-x.count);return `<div class="card"><div class="section-head"><div><h2>${t('taxonomyDiscovery')}</h2><div class="meta">${S.lang==='id'?'Other diperlakukan sebagai discovery channel, bukan bucket akhir.':'Other is treated as a discovery channel, not a final bucket.'}</div></div><span class="pill warn">${rows.reduce((s,x)=>s+x.count,0)} cases</span></div>${rows.length?`<div class="table-wrap"><table class="table"><thead><tr><th>${S.lang==='id'?'Alasan Riil Mentah':'Raw Actual Reason'}</th><th>Cases</th><th>SFA yang Dipakai</th><th>Evidence</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.label)}</b></td><td>${r.count}</td><td>${[...new Set(r.cases.map(c=>sfaLabel(c,S.taxonomy,S.lang)))].map(esc).join(', ')}</td><td>${r.cases.slice(0,3).map(c=>esc(c.evidence||'-')).join('<br>')}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">${t('noData')}</div>`}</div>`}
function renderCallTable(data,v=null){return `<div class="card"><div class="section-head"><h2>Call Detail</h2><span class="small muted">${data.calls.length} rows</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Check-in</th><th>Checkout</th><th>Duration</th><th>JOVIS</th><th>${S.lang==='id'?'Kode Toko':'Store Code'}</th><th>${S.lang==='id'?'Nama Toko':'Store Name'}</th><th>Route</th><th>Result</th><th>Omzet</th><th>Actual Reason</th><th>SFA Reason</th><th>Status</th><th>Evidence</th><th></th></tr></thead><tbody>${data.calls.map(c=>`<tr><td>${fmtTime(c.checkin_at||c.call_timestamp)}</td><td>${fmtTime(c.checkout_at)}</td><td>${fmtDuration(c.duration_seconds)}</td><td>${esc(profileName(c.jovis_user_id))}</td><td>${esc(c.outlet_id||'')}</td><td>${esc(c.outlet_name)}</td><td>${c.route_status}</td><td>${c.result}</td><td>${c.result==='EC'?fmtCurrency(c.omzet):''}</td><td>${c.result==='NON_EC'?esc(observedLabel(c,S.taxonomy,S.lang)):''}</td><td>${c.result==='NON_EC'?esc(sfaLabel(c,S.taxonomy,S.lang)):''}</td><td>${c.reason_match_status||''}</td><td>${esc(c.evidence||'')}</td><td><button class="btn btn-secondary" data-edit-call="${c.id}" data-visit-id="${c.visit_id}">${t('edit')}</button></td></tr>`).join('')}</tbody></table></div></div>`}

function renderAdmin(){if(!isAdmin())return `<div class="card"><h1>Unauthorized</h1></div>`;const data=filteredData('admin'),a=analyze(data.visits,data.calls,S.taxonomy,S.lang),dwell=dwellStats(data.calls);const depots=[...new Set(S.visits.filter(v=>!v.is_deleted).map(v=>v.depot).filter(Boolean))].sort();return `<div class="card hero"><div class="section-head"><div><span class="pill blue">${t('roleAdmin')}</span><h1 style="margin-top:10px">${t('adminOverview')}</h1><p class="muted small">${S.lang==='id'?'Data terbaru saat halaman direfresh. Auto refresh 60 detik aktif; tidak menggunakan realtime streaming.':'Data refreshes on load/refresh. 60-second auto refresh; no realtime streaming.'}</p></div><div class="header-actions"><button class="btn btn-danger" data-action="purgeTestVisits">${S.lang==='id'?'Hapus Visit Testing':'Delete Test Visits'}</button><button class="btn btn-secondary" data-action="refresh">↻ ${t('refresh')}</button></div></div><div class="grid3"><div class="field"><label>${t('date')}</label><input id="filterDate" class="input" type="date" value="${S.filters.date}"></div><div class="field"><label>JOVIS</label><select id="filterJovis" class="select"><option value="">Semua</option>${S.profiles.filter(p=>p.role==='jovis').map(p=>`<option value="${p.id}" ${S.filters.jovis===p.id?'selected':''}>${esc(p.display_name||p.email)}</option>`).join('')}</select></div><div class="field"><label>${t('depot')}</label><select id="filterDepot" class="select"><option value="">Semua</option>${depots.map(d=>`<option ${S.filters.depot===d?'selected':''}>${esc(d)}</option>`).join('')}</select></div></div><div class="kpis"><div class="kpi"><b>${data.visits.filter(v=>v.status==='active').length}</b><span>Active Visits</span></div><div class="kpi"><b>${a.sc}</b><span>${t('sc')}</span></div><div class="kpi"><b>${a.ecsc}%</b><span>${t('ecsc')}</span></div><div class="kpi"><b>${fmtCurrency(a.totalRevenue)}</b><span>${t('revenue')}</span></div><div class="kpi"><b>${a.ne}</b><span>${t('nonEc')}</span></div><div class="kpi"><b>${a.status.MISMATCH}</b><span>${t('mismatch')}</span></div><div class="kpi"><b>${Object.values(a.customReasons).reduce((s,x)=>s+x.count,0)}</b><span>${t('unmapped')}</span></div><div class="kpi"><b>${S.sync.pending}</b><span>Pending Sync</span></div><div class="kpi"><b>${fmtDuration(dwell.avg)}</b><span>${S.lang==='id'?'Avg Waktu / Call':'Avg Time / Call'}</span></div></div><div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" data-action="exportAdmin">${t('exportDetail')}</button><button class="btn btn-secondary" data-route="analysis">${t('analysis')}</button></div></div><div class="card"><h2>JOVIS / Visit Monitor</h2><div class="table-wrap"><table class="table"><thead><tr><th>JOVIS</th><th>Date</th><th>Depot</th><th>Salesman</th><th>Start</th><th>Status</th><th>SC</th><th>EC</th><th>EC/SC</th><th>Omzet</th><th>${S.lang==='id'?'Avg Waktu':'Avg Time'}</th><th></th></tr></thead><tbody>${data.visits.map(v=>{const z=visitStats(v),vd=dwellStats(visitCalls(v.id));return`<tr><td>${esc(profileName(v.jovis_user_id))}</td><td>${v.visit_date}</td><td>${esc(v.depot)}</td><td>${esc(v.salesman_name)}</td><td>${fmtTime(v.start_time)}</td><td>${v.status}</td><td>${z.sc}</td><td>${z.ec}</td><td>${z.ecsc}%</td><td>${fmtCurrency(z.revenue)}</td><td>${fmtDuration(vd.avg)}</td><td><div class="action-stack"><button class="btn btn-secondary" data-open-visit="${v.id}">${t('analysis')}</button><button class="btn btn-secondary" data-edit-visit="${v.id}">${t('edit')}</button><button class="btn btn-danger" data-delete-visit="${v.id}">${t('delete')}</button></div></td></tr>`}).join('')}</tbody></table></div></div>${renderUnmapped(a,data)}`}

function diagnosticPill(status){const cls=status==='PASS'?'good':status==='FAIL'?'bad':'warn';return `<span class="pill ${cls}">${status}</span>`}
async function loadDiagnosticsData(){const q=await queueDiagnostics();S.queueItems=q.items||[];return q}
async function runQaDiagnostics(){
  const results=[];const add=(name,status,detail)=>results.push({name,status,detail});
  try{await Local.all('queue');add('Local IndexedDB','PASS','Local database dapat dibaca.')}catch(e){add('Local IndexedDB','FAIL',e.message)}
  try{const session=await Auth.currentSession();add('Auth Session',session?.user?'PASS':'FAIL',session?.user?`Authenticated: ${session.user.email||session.user.id}`:'Tidak ada authenticated session.')}catch(e){add('Auth Session','FAIL',e.message)}
  add('Application Profile',S.profile?.id&&S.profile?.role?'PASS':'FAIL',S.profile?`${S.profile.email||S.profile.display_name||S.profile.id} · role=${S.profile.role}`:'Profile tidak ditemukan.');
  try{
    const snap=await Cloud.diagnosticSnapshot();
    const ownVisits=snap.visits.filter(v=>v.jovis_user_id===S.user.id).length,ownCalls=snap.calls.filter(c=>c.jovis_user_id===S.user.id).length;
    if(isAdmin()) add('Database / Admin Visibility',snap.profiles.some(p=>p.id===S.user.id)?'PASS':'FAIL',`Visible profiles=${snap.profiles.length}, visits=${snap.visits.length}, calls=${snap.calls.length}.`);
    else {
      const foreignVisit=snap.visits.some(v=>v.jovis_user_id!==S.user.id),foreignCall=snap.calls.some(c=>c.jovis_user_id!==S.user.id),foreignProfile=snap.profiles.some(p=>p.id!==S.user.id);
      add('RLS Ownership Check',(!foreignVisit&&!foreignCall&&!foreignProfile)?'PASS':'FAIL',`Visible profiles=${snap.profiles.length}, own visits=${ownVisits}, own calls=${ownCalls}; foreign rows visible=${foreignVisit||foreignCall||foreignProfile?'YES':'NO'}.`);
    }
  }catch(e){add('Supabase Database','FAIL',e.message)}
  const q=await queueDiagnostics();add('Sync Queue',q.errors?'WARN':'PASS',`${q.total} queued · ${q.errors} error.`);
  S.diagnostics={ranAt:nowISO(),results};await loadDiagnosticsData();render();
}
function queueEntityLabel(item){const id=item.payload?.id||'-';const outlet=item.entity==='call'?(item.payload?.outlet_name||''):'';return `${item.entity.toUpperCase()} · ${outlet?`${outlet} · `:''}${String(id).slice(0,8)}`}
function renderSyncDiagnostics(){
  const qs=S.queueItems||[];const errors=qs.filter(q=>q.status==='ERROR');
  return `<div class="card" id="syncDiagnostics"><div class="section-head"><div><h2>${S.lang==='id'?'Sync & QA Diagnostic':'Sync & QA Diagnostics'}</h2><div class="meta">${S.lang==='id'?'Badge Sync di header bisa diklik kapan saja. Error queue tetap tersimpan lokal sampai berhasil disinkronkan.':'The header Sync badge opens this panel. Failed queue items remain local until successfully synced.'}</div></div><span class="pill ${errors.length?'bad':qs.length?'warn':'good'}">${qs.length} queue · ${errors.length} error</span></div><div class="btn-row"><button class="btn btn-primary" data-action="runDiagnostics">${S.lang==='id'?'Jalankan Diagnostic':'Run Diagnostics'}</button><button class="btn btn-secondary" data-action="sync">↻ Sync Now</button>${errors.length?`<button class="btn btn-secondary" data-action="retryAllErrors">Retry ${errors.length} Error</button>`:''}</div>${S.diagnostics?`<div style="margin-top:12px"><div class="meta">Last run: ${fmtDate(S.diagnostics.ranAt)} ${fmtTime(S.diagnostics.ranAt)}</div><div class="diag-list">${S.diagnostics.results.map(r=>`<div class="diag-row">${diagnosticPill(r.status)}<div><b>${esc(r.name)}</b><div class="small muted">${esc(r.detail)}</div></div></div>`).join('')}</div></div>`:''}<h3 style="margin-top:16px">${S.lang==='id'?'Offline / Sync Queue':'Offline / Sync Queue'}</h3>${qs.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Record</th><th>Status</th><th>Attempts</th><th>Last Error</th><th></th></tr></thead><tbody>${qs.map(q=>`<tr><td>${esc(queueEntityLabel(q))}</td><td>${q.status}</td><td>${q.attempts||0}</td><td class="error-cell">${esc(q.last_error||'-')}</td><td>${q.status==='ERROR'?`<button class="btn btn-secondary" data-retry-queue="${q.id}">Retry</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:`<div class="notice good">${S.lang==='id'?'Tidak ada data yang tertahan di queue.':'No records are waiting in the sync queue.'}</div>`}<div class="notice" style="margin-top:10px"><b>${S.lang==='id'?'Data safety':'Data safety'}:</b> ${S.lang==='id'?'Jangan clear site/browser data saat masih ada queue. Queue lokal adalah copy yang belum berhasil dikirim ke cloud.':'Do not clear site/browser data while queue items remain; they are the local copy not yet acknowledged by the cloud.'}</div></div>`
}
function renderSettings(){const legacy=!!localStorage.getItem('nabati_fvi_v0_2');return `<div class="card"><h1>${t('settings')}</h1><div class="grid2"><div class="field"><label>${S.lang==='id'?'Nama Akun':'Account Name'}</label><input class="input" value="${esc(S.profile.display_name||'')}" readonly></div><div class="field"><label>Role</label><input class="input" value="${esc(S.profile.role)}" readonly></div></div><div class="field"><label>Language</label><select id="languageSelect" class="select"><option value="id" ${S.lang==='id'?'selected':''}>Bahasa Indonesia</option><option value="en" ${S.lang==='en'?'selected':''}>English</option></select></div><div class="notice good">${S.lang==='id'?'Data operasional utama disimpan di Supabase. IndexedDB di HP menjadi local cache/offline queue.':'Operational data is stored in Supabase. IndexedDB is used as local cache/offline queue.'}</div><div class="btn-row settings-actions" style="margin-top:12px"><button class="btn btn-secondary" data-action="backupJson">JSON Backup</button><button class="btn btn-danger" data-action="logout">${t('logout')}</button></div></div>${renderSyncDiagnostics()}<div class="card"><h2>v0.2 → v0.3 Migration</h2><p class="muted small">${S.lang==='id'?'Data local v0.2 tidak dihapus otomatis. Migration meng-copy visit lama ke akun yang sedang login, membuat UUID baru, lalu memasukkannya ke offline queue untuk sync ke Supabase.':'v0.2 local data is never deleted automatically.'}</p>${legacy?`<button class="btn btn-primary" data-action="migrateLegacy">Migrate v0.2 Local Data</button>`:`<div class="empty">Tidak ada localStorage v0.2 terdeteksi pada origin/browser ini.</div>`}</div><div class="card"><h2>Supabase Connection</h2><div class="notice">Project URL + Publishable Key berada di <code>src/config/supabase-config.js</code>. Secret key tidak boleh ada di repo.</div></div>`}

async function submitVisit(form){const fd=Object.fromEntries(new FormData(form).entries()),editId=form.dataset.editId;if(editId){const v=S.visits.find(x=>x.id===editId);if(!v)return;Object.assign(v,{visit_date:fd.visit_date,depot:fd.depot.trim(),salesman_name:fd.salesman_name.trim(),salesman_id:fd.salesman_id.trim(),notes:fd.notes.trim(),client_updated_at:nowISO()});await Local.put('visits',v);await enqueue('visit','UPSERT',v);await refreshData({quiet:true});route('analysis',{visitId:v.id});showToast('Visit updated');return}
  if(activeVisit()){showToast(t('oneActive'));return}
  const v={id:uuid(),jovis_user_id:S.user.id,visit_date:fd.visit_date,depot:fd.depot.trim(),salesman_name:fd.salesman_name.trim(),salesman_id:fd.salesman_id.trim(),route_segment:null,notes:fd.notes.trim(),start_time:nowISO(),end_time:null,status:'active',client_created_at:nowISO(),client_updated_at:nowISO(),is_deleted:false};
  await Local.put('visits',v);S.visits.push(v);await enqueue('visit','UPSERT',v);S.selectedVisitId=v.id;resetCallDraft();route('field');
}
function captureInputs(){const d=S.callDraft;if(!d)return;const g=id=>document.getElementById(id);if(g('outletName'))d.outlet_name=g('outletName').value;if(g('outletCodeDigits'))d.outlet_id=canonicalStoreCode(g('outletCodeDigits').value);if(g('omzet'))d.omzet=g('omzet').value===''?null:num(g('omzet').value);if(g('customReason'))d.custom_real_reason=g('customReason').value;if(g('factor'))d.contributing_factor=g('factor').value||null;if(g('evidence'))d.evidence=g('evidence').value;if(g('sfaWhy'))d.sfa_selection_reason=g('sfaWhy').value;if(g('revisit'))d.revisit_plan=g('revisit').value||null;if(g('earlier'))d.can_revisit_earlier=g('earlier').value||null;if(g('timing'))d.followup_timing_reason=g('timing').value;if(g('quickNote'))d.quick_note=g('quickNote').value;d.client_updated_at=nowISO();saveDraftLocal()}
async function saveCall(){
  captureInputs();const d=S.callDraft,v=S.visits.find(x=>x.id===d.visit_id);if(!v)return;
  if(!S.editingCallId&&!d.checkin_at){S.geoError=S.lang==='id'?'Call harus Check In dengan lokasi sebelum dapat disimpan.':'Call must be checked in with location before it can be saved.';render();return}
  if(!d.outlet_name.trim()&&!d.outlet_id.trim()){showToast(S.lang==='id'?'Isi nama toko atau kode toko':'Enter store name or store code');return}
  if(d.result==='EC'&&(d.omzet===null||d.omzet==='')){showToast(t('requiredOmzet'));return}
  if(d.result==='NON_EC'){if(!d.observed_reason_code){showToast('Pilih alasan aktual');return}if(d.observed_reason_code==='other'&&!d.custom_real_reason.trim()){showToast(t('customOtherRequired'));return}if(!d.sfa_reason_code){showToast('Pilih reason SFA');return}d.reason_match_status=classifyReason(d)}
  if(!d.result){showToast(S.lang==='id'?'Pilih hasil EC / Non-EC':'Select EC / Non-EC result');return}
  const wasEditing=!!S.editingCallId;
  if(!wasEditing){const checkoutOk=await captureCheckoutLocation();if(!checkoutOk)return;d.call_timestamp=d.checkin_at;}
  d.client_updated_at=nowISO();
  await Local.put('calls',d);const ix=S.calls.findIndex(x=>x.id===d.id);if(ix>=0)S.calls[ix]=structuredClone(d);else S.calls.push(structuredClone(d));await enqueue('call','UPSERT',d);await Local.del('drafts',`call:${v.id}`);
  if(wasEditing && v.status==='completed'){S.callDraft=null;S.callStage=0;S.editingCallId=null;S.selectedVisitId=v.id;route('analysis');showToast('Call diperbarui');return}
  resetCallDraft();render();showToast(wasEditing?'Call diperbarui':(S.lang==='id'?`Call tersimpan · ${fmtDuration(d.duration_seconds)}`:`Call saved · ${fmtDuration(d.duration_seconds)}`));
}
async function editCall(id,visitId){const c=S.calls.find(x=>x.id===id);if(!c)return;S.selectedVisitId=visitId;S.callDraft=structuredClone(c);S.callStage=0;S.editingCallId=id;route('field')}
async function endVisit(){const v=activeVisit();if(!v)return;if(S.callDraft?.visit_id===v.id&&S.callDraft?.checkin_at&&!S.editingCallId){showToast(S.lang==='id'?'Selesaikan call yang sudah Check In sebelum mengakhiri visit.':'Finish the checked-in call before ending the visit.');return}if(!confirm(`Selesaikan visit dengan ${visitCalls(v.id).length} call?`))return;v.status='completed';v.end_time=nowISO();v.client_updated_at=nowISO();await Local.put('visits',v);await enqueue('visit','UPSERT',v);await Local.del('drafts',`call:${v.id}`);S.callDraft=null;S.selectedVisitId=v.id;route('analysis');}

async function deleteVisitCascade(visitId,{silent=false}={}){
  if(!isAdmin()) return;
  const v=S.visits.find(x=>x.id===visitId); if(!v) return;
  const related=visitCalls(v.id);
  const label=`${v.depot||'-'} · ${v.salesman_name||'-'} · ${fmtDate(v.visit_date)}`;
  if(!silent){
    const msg=S.lang==='id'
      ? `Hapus visit ini?\n\n${label}\n${related.length} call akan ikut disembunyikan dari analisis.\nDipakai untuk cleanup data testing.`
      : `Delete this visit?\n\n${label}\n${related.length} calls will also be hidden from analysis.\nUse this for test-data cleanup.`;
    if(!confirm(msg)) return;
  }
  const deletedAt=nowISO();
  const visitPatch={...v,is_deleted:true,deleted_at:deletedAt,client_updated_at:deletedAt};
  await Local.put('visits',visitPatch);
  await enqueue('visit','UPSERT',visitPatch);
  const vix=S.visits.findIndex(x=>x.id===v.id); if(vix>=0) S.visits[vix]=visitPatch;
  for(const call of related){
    const callPatch={...call,is_deleted:true,deleted_at:deletedAt,client_updated_at:deletedAt};
    await Local.put('calls',callPatch);
    await enqueue('call','UPSERT',callPatch);
    const cix=S.calls.findIndex(x=>x.id===call.id); if(cix>=0) S.calls[cix]=callPatch;
  }
  await Local.del('drafts',`call:${v.id}`);
  if(S.selectedVisitId===v.id) S.selectedVisitId=null;
  if(S.callDraft?.visit_id===v.id){S.callDraft=null;S.callStage=0;S.editingCallId=null}
  if(!silent){
    await refreshData({quiet:true});
    route(isAdmin()?'admin':'home');
    showToast(S.lang==='id'?'Visit dihapus dari dataset aktif':'Visit removed from active dataset');
  }
}

async function purgeTestVisits(){
  if(!isAdmin()) return;
  const candidates=S.visits.filter(v=>(!v.is_deleted) && (/^(test|qa)$/i.test((v.depot||'').trim()) || /^(test|qa)$/i.test((v.salesman_name||'').trim())));
  if(!candidates.length){showToast(S.lang==='id'?'Tidak ada visit testing terdeteksi':'No test visits detected');return}
  const msg=S.lang==='id'
    ? `Hapus ${candidates.length} visit testing sekaligus?`
    : `Delete ${candidates.length} test visits at once?`;
  if(!confirm(msg)) return;
  for(const v of candidates) await deleteVisitCascade(v.id,{silent:true});
  await refreshData({quiet:true});
  route('admin');
  showToast(S.lang==='id'?'Cleanup visit testing selesai':'Test-visit cleanup complete');
}

async function migrateLegacy(){const raw=localStorage.getItem('nabati_fvi_v0_2');if(!raw)return;let old;try{old=JSON.parse(raw)}catch{showToast('Invalid v0.2 data');return}if(!confirm(`Migrate ${(old.visits||[]).length} visit v0.2 ke akun ${S.profile.display_name||S.user.email}? Data lama tidak akan dihapus.`))return;let vc=0,cc=0;for(const ov of old.visits||[]){const vid=uuid();const v={id:vid,jovis_user_id:S.user.id,visit_date:ov.date||today(),depot:ov.depot||'',salesman_name:ov.salesman||'',salesman_id:ov.salesmanId||'',route_segment:ov.routeTeam||null,notes:`[Migrated v0.2] ${ov.notes||''}`.trim(),start_time:ov.startedAt||nowISO(),end_time:ov.endedAt||null,status:ov.status==='active'?'completed':(ov.status||'completed'),client_created_at:ov.startedAt||nowISO(),client_updated_at:nowISO(),is_deleted:false};await Local.put('visits',v);await enqueue('visit','UPSERT',v);vc++;for(const oc of ov.calls||[]){const c={id:uuid(),visit_id:vid,jovis_user_id:S.user.id,outlet_id:oc.outletId||'',outlet_name:oc.outletName||'',route_status:oc.routeStatus==='OFF ROUTE'?'OFF_ROUTE':(oc.routeStatus||'JKS').replace(' ','_'),result:oc.result,call_timestamp:oc.callAt||oc.createdAt||v.start_time,omzet:oc.result==='EC'?num(oc.orderValue):null,observed_reason_code:oc.observedPrimaryId||null,custom_real_reason:oc.customObservedReason||'',contributing_factor:oc.contributingFactorId||null,evidence:oc.evidence||'',sfa_reason_code:oc.sfaReasonId||null,reason_match_status:oc.reasonStatusFinal||oc.reasonStatusAuto||null,sfa_selection_reason:oc.sfaSelectionWhyText||oc.sfaSelectionWhyCode||'',revisit_plan:oc.followupPlan||null,can_revisit_earlier:oc.canRevisitEarlier||null,followup_timing_reason:oc.followupTimingReason||'',quick_note:oc.quickNote||'',client_created_at:oc.createdAt||nowISO(),client_updated_at:oc.updatedAt||nowISO(),is_deleted:false};await Local.put('calls',c);await enqueue('call','UPSERT',c);cc++}}
  await refreshData({quiet:true});render();showToast(`Migrated ${vc} visits / ${cc} calls`)
}

async function handleClick(e){const b=e.target.closest('button,[data-route],[data-open-visit],[data-edit-visit],[data-retry-queue]');if(!b)return;
  if(b.dataset.route){if(b.dataset.route==='field'){const v=activeVisit();if(v){S.selectedVisitId=v.id;await restoreDraft(v)}else{route('setup');return}}route(b.dataset.route);return}
  if(b.dataset.openVisit){S.selectedVisitId=b.dataset.openVisit;route('analysis');return}
  if(b.dataset.editVisit){S.route='setup';root.innerHTML=shell(renderVisitSetup(b.dataset.editVisit));return}
  if(b.dataset.deleteVisit){await deleteVisitCascade(b.dataset.deleteVisit);return}
  if(b.dataset.routeStatus){captureInputs();S.callDraft.route_status=b.dataset.routeStatus;render();return}
  if(b.dataset.result){captureInputs();S.callDraft.result=b.dataset.result;if(S.callDraft.result!=='EC')S.callDraft.omzet=null;render();return}
  if(b.dataset.observed){captureInputs();S.callDraft.observed_reason_code=b.dataset.observed;if(b.dataset.observed!=='other')S.callDraft.custom_real_reason='';render();return}
  if(b.dataset.sfa){captureInputs();S.callDraft.sfa_reason_code=b.dataset.sfa;S.callDraft.reason_match_status=classifyReason(S.callDraft);render();return}
  if(b.dataset.editCall){await editCall(b.dataset.editCall,b.dataset.visitId);return}
  if(b.dataset.retryQueue){await retryItem(b.dataset.retryQueue);await refreshData({quiet:true});await loadDiagnosticsData();render();showToast('Retry selesai');return}
  const a=b.dataset.action;if(!a)return;
  if(a==='checkInCall'){await checkInCurrentCall();return}
  if(a==='lang'){S.lang=S.lang==='id'?'en':'id';await Local.setSetting('language',S.lang);render();return}
  if(a==='logout'){await Auth.signOut();location.reload();return}
  if(a==='purgeTestVisits'){await purgeTestVisits();return}
  if(a==='openDiagnostics'){S.route='settings';await loadDiagnosticsData();render();return}
  if(a==='runDiagnostics'){await runQaDiagnostics();return}
  if(a==='retryAllErrors'){await retryAllErrors();await refreshData({quiet:true});await loadDiagnosticsData();render();showToast('Retry queue selesai');return}
  if(a==='nextActual'){captureInputs();if(!S.callDraft.outlet_name.trim()&&!S.callDraft.outlet_id.trim()){showToast('Isi outlet');return}S.callStage=1;await saveDraftLocal();render();return}
  if(a==='nextSfa'){captureInputs();if(!S.callDraft.observed_reason_code){showToast('Pilih alasan aktual');return}if(S.callDraft.observed_reason_code==='other'&&!S.callDraft.custom_real_reason.trim()){showToast(t('customOtherRequired'));return}S.callStage=2;await saveDraftLocal();render();return}
  if(a==='prevStage'){captureInputs();S.callStage=Math.max(0,S.callStage-1);await saveDraftLocal();render();return}
  if(a==='saveEc'||a==='saveNonEc'){await saveCall();return}
  if(a==='endVisit'){await endVisit();return}
  if(a==='refresh'){await refreshData();showToast('Data refreshed');return}
  if(a==='sync'){await syncNow();await refreshData({quiet:true});await loadDiagnosticsData();render();showToast(S.sync.errors?'Sync selesai dengan error':'Sync complete');return}
  if(a==='exportCurrent'){const v=S.selectedVisitId?S.visits.find(x=>x.id===S.selectedVisitId):null;const d=v?{visits:[v],calls:visitCalls(v.id)}:filteredData();exportDetailedExcel({...d,taxonomy:S.taxonomy,profiles:S.profiles,language:S.lang});return}
  if(a==='exportAdmin'){const d=filteredData();exportDetailedExcel({...d,taxonomy:S.taxonomy,profiles:S.profiles,language:S.lang});return}
  if(a==='backupJson'){exportJsonBackup({schemaVersion:APP_VERSION,exportedAt:nowISO(),user:S.profile,profiles:S.profiles,visits:S.visits,calls:S.calls,taxonomy:S.taxonomy,reasonMappings:S.reasonMappings});return}
  if(a==='migrateLegacy'){await migrateLegacy();return}
}

async function handleSubmit(e){if(e.target.id==='loginForm'){e.preventDefault();const fd=new FormData(e.target),err=document.getElementById('loginError');try{await Auth.signIn(fd.get('email'),fd.get('password'));S.session=await Auth.currentSession();S.user=S.session.user;await afterLogin()}catch(x){err.textContent=x.message;err.classList.remove('hidden')}return}if(e.target.id==='visitForm'){e.preventDefault();await submitVisit(e.target)}}
async function handleChange(e){if(e.target.id==='languageSelect'){S.lang=e.target.value;await Local.setSetting('language',S.lang);render()}if(['filterDate','filterJovis','filterDepot'].includes(e.target.id)){S.filters[e.target.id.replace('filter','').toLowerCase()]=e.target.value;render()}captureInputs()}
document.addEventListener('click',handleClick);document.addEventListener('submit',handleSubmit);document.addEventListener('change',handleChange);document.addEventListener('input',e=>{if(e.target.id==='outletCodeDigits'){const clean=storeCodeDigits(e.target.value);if(e.target.value!==clean)e.target.value=clean}if(['outletName','outletCodeDigits','omzet','customReason','evidence','sfaWhy','timing','quickNote'].includes(e.target.id))captureInputs()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&safeToBackgroundPull())refreshData({quiet:false}).catch(()=>{})});
window.addEventListener('focus',()=>{if(safeToBackgroundPull())refreshData({quiet:false}).catch(()=>{})});

boot();
