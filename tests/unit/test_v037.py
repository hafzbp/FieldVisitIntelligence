from pathlib import Path
import re, subprocess, sys
root=Path(__file__).resolve().parents[2]
results=[]
def check(name, cond, detail=''):
    results.append((name,bool(cond),detail))
    if not cond: print('FAIL',name,detail)

cfg=(root/'src/config/app-config.js').read_text()
cloud=(root/'src/data/cloud-repository.js').read_text()
sync=(root/'src/data/sync-engine.js').read_text()
sw=(root/'sw.js').read_text()
app=(root/'src/ui/app.js').read_text()
exp=(root/'src/export/exporter.js').read_text()
mig=(root/'supabase/migrations/202608110004_add_call_checkin_location.sql').read_text()
css=(root/'assets/styles.css').read_text()

check('Version 0.3.8', "APP_VERSION = '0.3.8'" in cfg)
check('Service worker cache v0.3.8', "CACHE='fvi-v0.3.8'" in sw)
check('Kode Toko Indonesian label', "outletId:'Kode Toko'" in cfg)
check('Store Code English label', "outletId:'Store Code'" in cfg)
check('Store code canonical C prefix', "canonicalStoreCode" in app and "`C${digits}`" in app)
check('Store code numeric-only UI', 'id="outletCodeDigits"' in app and 'inputmode="numeric"' in app and 'storeCodeDigits' in app)
check('Mandatory check-in gate exists', 'CHECK IN CALL #' in app and "data-action=\"checkInCall\"" in app)
check('Browser geolocation required', 'navigator.geolocation.getCurrentPosition' in app and 'enableHighAccuracy:true' in app)
check('Denied location blocks call', 'Permission lokasi wajib diaktifkan' in app and 'if(!S.editingCallId&&!d.checkin_at)' in app)
check('Check-in timestamp captured', 'd.checkin_at=requestedAt' in app and 'd.call_timestamp=requestedAt' in app)
check('Checkout timestamp captured', 'd.checkout_at=requestedAt' in app)
check('Duration calculated', 'durationSeconds(d.checkin_at,d.checkout_at)' in app)
check('Save performs checkout location', 'await captureCheckoutLocation()' in app)
check('End visit blocked during checked-in call', 'Selesaikan call yang sudah Check In' in app)
for field in ['checkin_at','checkout_at','checkin_latitude','checkin_longitude','checkin_accuracy_m','checkout_latitude','checkout_longitude','checkout_accuracy_m','duration_seconds']:
    check(f'Cloud payload includes {field}', f"'{field}'" in cloud)
    check(f'Migration adds {field}', field in mig)
check('Migration schema file present', 'alter table public.calls' in mig and 'idx_calls_checkin_at' in mig)
check('Export includes check-in / checkout / duration', 'Check-in At' in exp and 'Checkout At' in exp and 'Duration Seconds' in exp)
check('Export includes GPS sheet', "09_DWELL_TIME_GPS" in exp)
check('Export uses Kode Toko', 'Kode Toko' in exp)
check('Check-in UI styles exist', '.checkin-gate' in css and '.store-code-prefix' in css)
check('Legacy deleted status repaired before cloud upsert', "!['active','completed'].includes(payload.status)" in cloud)
check('Queue coalesces duplicate record', 'duplicates=queue.filter' in sync and 'duplicates.slice(1)' in sync)

# No privileged Supabase secret value.
secret_hits=[]
for p in root.rglob('*'):
    if p.is_file() and p.suffix.lower() not in {'.png','.jpg','.jpeg','.zip'}:
        try: text=p.read_text(errors='ignore')
        except: continue
        if re.search(r'sb_secret_[A-Za-z0-9_\-]{8,}',text): secret_hits.append(str(p.relative_to(root)))
check('No Supabase secret key value in repo',not secret_hits,', '.join(secret_hits))

# JavaScript syntax.
syntax_ok=True;errors=[]
for f in list((root/'src').rglob('*.js'))+[root/'sw.js']:
    r=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
    if r.returncode:
        syntax_ok=False;errors.append(f'{f.name}: {r.stderr.strip()}')
check('JavaScript syntax',syntax_ok,' | '.join(errors))

print('\nQA SUMMARY')
for name,ok,detail in results: print(('PASS' if ok else 'FAIL'),'-',name,(f'({detail})' if detail else ''))
failed=sum(not ok for _,ok,_ in results)
print(f'\n{len(results)-failed} PASS / {failed} FAIL')
sys.exit(1 if failed else 0)
