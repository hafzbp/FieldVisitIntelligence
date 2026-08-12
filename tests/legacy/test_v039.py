from pathlib import Path
import re, subprocess, sys, json
root=Path(__file__).resolve().parents[2]
results=[]
def check(name, cond, detail=''):
    results.append((name,bool(cond),detail))
    if not cond: print('FAIL',name,detail)

cfg=(root/'src/config/app-config.js').read_text()
app=(root/'src/ui/app.js').read_text()
cloud=(root/'src/data/cloud-repository.js').read_text()
reason=(root/'src/domain/reason-engine.js').read_text()
analysis=(root/'src/domain/analysis-engine.js').read_text()
exp=(root/'src/export/exporter.js').read_text()
mig=(root/'supabase/migrations/202608120007_exact_sfa_legacy_recovery_tombstone_safe.sql').read_text()
sw=(root/'sw.js').read_text()
version=json.loads((root/'version.json').read_text())

check('Version 0.3.10', "APP_VERSION = '0.3.10'" in cfg and version['version']=='0.3.10')
check('Service worker cache v0.3.10', "CACHE='fvi-v0.3.10'" in sw)
for label in ['Pemilik tidak ada ditempat','Nanti ditelpon saja','Barang masih ada','Toko tidak ada uang','Toko Tutup','Ambil dari supplier lain','Lainnya']:
    check(f'Exact SFA option: {label}', label in cfg and label in mig)
check('Observed and SFA taxonomy separated', "type:'observed'" in cfg and "type:'sfa'" in cfg and "reason_type = 'observed'" in mig)
check('Safe legacy mapping is conservative', "stock:'sfa_stock_available'" in cfg and "financial:'sfa_no_cash'" in cfg and "closed:'sfa_store_closed'" in cfg and "pic:'sfa_owner_absent'" not in cfg)
for field in ['sfa_reason_exact_code','sfa_capture_type','sfa_recovery_status']:
    check(f'Cloud payload includes {field}', f"'{field}'" in cloud)
    check(f'Migration adds {field}', f'add column if not exists {field}' in mig)
check('Migration preserves legacy reason field', 'Legacy sfa_reason_code is intentionally retained unchanged' in mig)
check('Migration auto-recovers only stock financial closed', "sfa_reason_code in ('stock','financial','closed')" in mig)
check('Migration cutover trigger exists', 'normalize_sfa_provenance_v039' in mig and 'trg_calls_sfa_provenance_v039' in mig)
check('Admin legacy recovery UI exists', 'SFA Legacy Recovery' in app and 'data-confirm-recovery' in app and 'MANUAL_CONFIRMED' in app)
check('New call uses exact SFA wording', 'Jangan diterjemahkan ke kategori actual reason' in app and "reasonChips(exact,'sfa','sfa')" in app)
check('Analysis excludes unresolved from forced mismatch', 'UNRESOLVED' in analysis and 'NON_CAUSAL' in analysis and 'TAXONOMY_GAP' in analysis)
check('Nanti ditelpon treated non-causal', "exact==='sfa_call_later'" in reason and "return 'NON_CAUSAL'" in reason)
check('Lainnya treated taxonomy gap', "exact==='sfa_other'" in reason and "return 'TAXONOMY_GAP'" in reason)
check('Export preserves exact + legacy provenance', 'SFA Reason Exact' in exp and 'SFA Legacy Reason' in exp and 'SFA Recovery Status' in exp)
check('Export includes recovery sheet', "10_SFA_RECOVERY" in exp)
check('Rollback v0.3.8 included', (root/'rollback/v0.3.8/FieldVisitIntelligence_v0.3.8_source.zip').exists())

node=subprocess.run(['node','--experimental-default-type=module',str(root/'tests/unit/test_v039.mjs')],capture_output=True,text=True)
check('Reason-engine executable unit test',node.returncode==0,node.stdout.strip()+(' | '+node.stderr.strip() if node.stderr.strip() else ''))

syntax_ok=True;errors=[]
for f in list((root/'src').rglob('*.js'))+[root/'sw.js']:
    r=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
    if r.returncode:
        syntax_ok=False;errors.append(f'{f.name}: {r.stderr.strip()}')
check('JavaScript syntax',syntax_ok,' | '.join(errors))

secret_hits=[]
for p in root.rglob('*'):
    if p.is_file() and p.suffix.lower() not in {'.png','.jpg','.jpeg','.zip'}:
        try: txt=p.read_text(errors='ignore')
        except: continue
        if re.search(r'sb_secret_[A-Za-z0-9_\-]{8,}',txt): secret_hits.append(str(p.relative_to(root)))
check('No Supabase secret key value in repo',not secret_hits,', '.join(secret_hits))

print('\nQA SUMMARY')
for name,ok,detail in results: print(('PASS' if ok else 'FAIL'),'-',name,(f'({detail})' if detail else ''))
failed=sum(not ok for _,ok,_ in results)
print(f'\n{len(results)-failed} PASS / {failed} FAIL')
sys.exit(1 if failed else 0)
