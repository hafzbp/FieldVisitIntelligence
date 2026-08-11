from pathlib import Path
import re, json, subprocess, sys
root=Path(__file__).resolve().parents[2]
results=[]
def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    if not cond: print('FAIL', name, detail)

cfg=(root/'src/config/app-config.js').read_text()
cloud=(root/'src/data/cloud-repository.js').read_text()
sync=(root/'src/data/sync-engine.js').read_text()
sw=(root/'sw.js').read_text()
app=(root/'src/ui/app.js').read_text()

check('Version 0.3.7', "APP_VERSION = '0.3.7'" in cfg)
check('Visit payload uses sanitizer', 'sanitizeVisitPayload(row)' in cloud and "upsert(payload" in cloud)
check('Call payload uses sanitizer', 'sanitizeCallPayload(row)' in cloud)

check('Legacy deleted status repaired before cloud upsert', "!['active','completed'].includes(payload.status)" in cloud and "row?.end_time ? 'completed' : 'active'" in cloud)
check('Admin soft delete does not assign invalid deleted status', "status:v.status==='active'?'deleted':v.status" not in app)
for bad in ['created_at','updated_at','last_edited_by']:
    # ensure not present inside whitelist blocks
    visit_block=re.search(r'const VISIT_FIELDS = \[(.*?)\];',cloud,re.S).group(1)
    call_block=re.search(r'const CALL_FIELDS = \[(.*?)\];',cloud,re.S).group(1)
    check(f'Visit whitelist excludes {bad}', f"'{bad}'" not in visit_block)
    check(f'Call whitelist excludes {bad}', f"'{bad}'" not in call_block)
check('Queue coalesces duplicate record', 'duplicates=queue.filter' in sync and 'duplicates.slice(1)' in sync)
check('Queue exposes retry item', 'export async function retryItem' in sync)
check('Queue exposes retry all errors', 'export async function retryAllErrors' in sync)
check('Sync error detail UI exists', 'Last Error' in app and 'data-retry-queue' in app)
check('Diagnostic panel exists', 'runQaDiagnostics' in app and 'diagnosticSnapshot' in app)
check('Sync badge is clickable', 'data-action="openDiagnostics"' in app)
check('Service worker network-first', "fetch(e.request).then" in sw and ".catch(()=>caches.match(e.request))" in sw)
check('Service worker cache v0.3.7', "CACHE='fvi-v0.3.7'" in sw)

# Detect actual secret values, not documentation terms.
secret_hits=[]
for p in root.rglob('*'):
    if p.is_file() and p.suffix.lower() not in {'.png','.jpg','.jpeg','.zip'}:
        try: text=p.read_text(errors='ignore')
        except: continue
        if re.search(r'sb_secret_[A-Za-z0-9_\-]{8,}', text): secret_hits.append(str(p.relative_to(root)))
check('No Supabase secret key value in repo', not secret_hits, ', '.join(secret_hits))

# Node syntax validation for JS.
jsfiles=list((root/'src').rglob('*.js'))+[root/'sw.js']
syntax_ok=True; syntax_errors=[]
for f in jsfiles:
    r=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
    if r.returncode:
        syntax_ok=False;syntax_errors.append(f'{f.name}: {r.stderr.strip()}')
check('JavaScript syntax',syntax_ok,' | '.join(syntax_errors))

print('\nQA SUMMARY')
for name,ok,detail in results: print(('PASS' if ok else 'FAIL'), '-', name, (f'({detail})' if detail else ''))
failed=sum(not ok for _,ok,_ in results)
print(f'\n{len(results)-failed} PASS / {failed} FAIL')
sys.exit(1 if failed else 0)
