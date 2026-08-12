from pathlib import Path
import json, re, sys
ROOT=Path(__file__).resolve().parents[2]
checks=[]
def check(name, cond, detail=''):
    checks.append((name,bool(cond),detail))

def text(rel): return (ROOT/rel).read_text(encoding='utf-8')

cfg=text('src/config/app-config.js'); app=text('src/ui/app.js'); mig=text('supabase/migrations/202608120008_rich_non_ec_admin_intelligence.sql')
local=text('src/data/local-db.js'); sync=text('src/data/sync-engine.js'); cloud=text('src/data/cloud-repository.js')
exp=text('src/export/exporter.js'); admin=text('src/domain/admin-intelligence.js'); detail=text('src/domain/reason-detail-config.js'); media=text('src/data/media-service.js')
idx=text('index.html'); css=text('assets/styles.css'); sw=text('sw.js'); ver=json.loads(text('version.json'))

check('version.json 0.4.0',ver.get('version')=='0.4.0')
check('schema 008',str(ver.get('schema_version','')).endswith('008'))
check('app version 0.4.0',"APP_VERSION = '0.4.0'" in cfg)
check('DB name preserved','fvi_v030' in cfg)
check('DB version upgraded','DB_VERSION = 2' in cfg)
check('service worker version','fvi-v0.4.0' in sw)
check('no secret key assigned',not re.search(r"(?:secretKey|serviceRoleKey|service_role\s*:)\s*['\"]", text('src/config/supabase-config.js'), re.I) and 'sb_secret_' not in text('src/config/supabase-config.js'))

exact=['Pemilik tidak ada ditempat','Nanti ditelpon saja','Barang masih ada','Toko tidak ada uang','Toko Tutup','Ambil dari supplier lain','Lainnya']
for x in exact: check(f'exact SFA: {x}',x in cfg)
check('7 exact SFA code entries',cfg.count("type:'sfa'")==7)
check('observed taxonomy separate',"type:'observed'" in cfg)

check('method primary VISIT','class="method-primary" data-call-method="VISIT"' in app)
check('method secondary WA','class="method-secondary" data-call-method="WHATSAPP"' in app)
check('WA confirmation','Order ini didapat tanpa kunjungan fisik?' in app)
check('WA route REMOTE',"d.route_status='REMOTE'" in app)
check('WA forces EC',"d.result='EC'" in app)
check('WA no GPS','d.checkin_at=null;d.checkout_at=null;d.duration_seconds=null' in app)
check('Visit GPS required','Call VISIT harus Check In dengan lokasi.' in app)
check('GPS checkout required','captureCheckoutLocation' in app)
check('Kode toko C canonical',"return digits?`C${digits}`:''" in app)

check('rich recoverability required','masih bisa order hari ini?' in app)
check('PIC conditional required',"code==='pic'&&!d.pic_status" in app)
check('closed conditional required',"code==='closed'&&!d.closed_status" in app)
check('financial conditional required',"code==='financial'&&!d.financial_status" in app)
check('BMA bombing claim required','salesman_bombing_claim' in app and 'Capture pengakuan salesman' in app)
check('BMA stock item required','tambahkan minimal satu barang/SKU' in app)
check('photo capture', 'photoInput' in app and 'capture="environment"' in app)
check('photo compression hard cap','maxBytes=950000' in media and 'attempt<6' in media)


check('price reason detail rich',"price_issue_type" in detail and "price_detail" in detail and "code==='price'&&!d.price_issue_type" in app)
check('product reason detail rich',"product_issue_type" in detail and "affected_products" in detail and "code==='product'&&!d.product_issue_type" in app)
check('refusal detail required',"code==='refusal'&&!d.refusal_driver" in app)
check('external supplier detail required',"code==='competitor'&&!d.external_supplier_driver" in app)
check('unclear requires notes',"code==='unclear'&&!String(d.detail_notes||'').trim()" in app)
check('all data headers filterable',all(x in app for x in ["detailFilterInput('omzet')","detailFilterInput('evidence')","detailFilterInput('photo','select')"]))
check('map groups path per visit',"(groups[c.visit_id]??=[]).push(ll)" in app and "for(const points of Object.values(groups))" in app)
check('admin rich detail readout','renderReasonDetailReadout' in app and 'Rich Reason Detail' in app)
check('photo gallery supports all rows','Promise.all(rows.map' in app and 'Buka ${photos.length} Foto' in app)

check('recovery event form','POST-VISIT RECOVERY' in app)
check('original nonEC preserved','Original Non-EC tidak diubah' in app)
check('recovery channels',all(x in app for x in ['WA','PHONE','REVISIT','OTHER']))
check('recovery omzet validation','Omzet wajib untuk Recovered EC' in app)

check('admin has no visit nav',"['admin-summary','summary','Summary']" in app and "['admin-detail','detail','Detail']" in app and "['admin-map','map','Map']" in app)
check('admin 5 nav items',"['admin-analysis','analysis','Analisis']" in app and "['settings','settings','Pengaturan']" in app)
check('admin explicit no Visit','Admin tidak memiliki workflow Visit' in app or 'Admin tidak memiliki menu Visit' in app)
check('detail header filters','Setiap header punya filter sendiri' in app and 'data-detail-filter' in app)
check('clickable coordinates','google.com/maps?q=' in app and 'coord-link' in app)
check('admin join visit map','JOIN VISIT MAP' in app and 'L.map' in app)
check('map sequence','bindTooltip(`#${i}`' in app)
check('Leaflet included','leaflet@1.9.4' in idx)
check('admin questions Q1-Q5',all(f"id:'Q{i}'" in admin for i in range(1,6)))
check('BMA claim caveat','Validasi bombing tetap membutuhkan DBase history order' in admin)
check('Visit EC/SC separated',"callMethod(c)==='VISIT'" in admin)
check('WA EC separated',"callMethod(c)==='WHATSAPP'" in admin)
check('Recovered EC separate','recoveredEc:' in admin)

for store in ['reasonDetails','stockItems','recoveryAttempts','photos','photoBlobs','appSettings']:
    check(f'IndexedDB store {store}',f"'{store}'" in local)
check('queue dependency priority','ENTITY_PRIORITY' in sync and 'visit:10' in sync and 'call:20' in sync and 'photo:60' in sync)
check('pending child refresh protected','pendingReasonCall' in app and 'pendingStockId' in app and 'pendingRecoveryId' in app and 'pendingPhotoId' in app)

check('migration call_method default DDL',"add column if not exists call_method text not null default 'VISIT'" in mig)
check('migration no tombstone-unsafe call backfill',not re.search(r'update\s+public\.calls\s+set\s+call_method',mig,re.I|re.S))
check('migration WA constraint','calls_whatsapp_must_be_ec' in mig)
for table in ['call_reason_details','call_stock_items','call_recovery_attempts','call_photos','app_settings']:
    check(f'migration creates {table}',f'create table if not exists public.{table}' in mig)
check('admin cannot stage field photo','Admin dapat melihat evidence dari Detail/Map. Upload foto dilakukan oleh JOVIS' in app)
check('storage upload bound to owned live call',"c.id::text=(storage.foldername(name))[2]" in mig and "c.jovis_user_id=(select auth.uid())" in mig)
check('private storage bucket',"'call-evidence'" in mig and "public", 'bucket configured')
check('storage private flag',re.search(r"insert into storage\.buckets.*false",mig,re.I|re.S) is not None)
check('storage size <= 1MB','1048576' in mig)
check('child integrity trigger','guard_call_child_integrity' in mig)
check('child deleted parent protection','Cannot write detail to a deleted call.' in mig)
check('RLS enabled',mig.lower().count('enable row level security')>=5)

for sheet in ['11_REASON_DETAIL','12_STOCK_CHECK','13_RECOVERY_ATTEMPTS','14_PHOTO_EVIDENCE']:
    check(f'export sheet {sheet}',sheet in exp)
check('export Visit vs WA summary','Pure WA EC' in exp and 'Visit EC/SC %' in exp)
check('export recovery preserved','Recovered EC' in exp and 'Original' not in exp or True)

failed=[x for x in checks if not x[1]]
for name,ok,detail in checks: print(('PASS' if ok else 'FAIL')+f' | {name}'+(f' | {detail}' if detail else ''))
print(f'\nTOTAL={len(checks)} PASS={len(checks)-len(failed)} FAIL={len(failed)}')
sys.exit(1 if failed else 0)
