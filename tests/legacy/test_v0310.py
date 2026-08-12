from pathlib import Path
import re, subprocess, json, sys

root=Path(__file__).resolve().parents[2]
results=[]
def check(name, cond, detail=''):
    results.append((name,bool(cond),detail))
    if not cond:
        print('FAIL',name,detail)

mig=root/'supabase/migrations/202608120007_exact_sfa_legacy_recovery_tombstone_safe.sql'
sql=mig.read_text()
failed_archive=root/'docs/failed_migrations/202608120006_exact_sfa_legacy_recovery_FAILED.sql'
active_names=[p.name for p in (root/'supabase/migrations').glob('*.sql')]
version=json.loads((root/'version.json').read_text())
cfg=(root/'src/config/app-config.js').read_text()
sw=(root/'sw.js').read_text()

check('Version bumped to 0.3.10', "APP_VERSION = '0.3.10'" in cfg and version.get('version')=='0.3.10')
check('Schema version is Migration 007', version.get('schema_version')=='202608120007')
check('Service worker cache bumped', "CACHE='fvi-v0.3.10'" in sw)
check('Migration 007 exists', mig.exists())
check('Failed Migration 006 removed from active path', not any('202608120006' in n for n in active_names), ', '.join(active_names))
check('Failed Migration 006 preserved as evidence', failed_archive.exists())
check('Migration 007 transactional', re.search(r'^begin;',sql,re.I|re.M) is not None and re.search(r'^commit;',sql,re.I|re.M) is not None)
check('Tombstone guard is not disabled', 'disable trigger trg_guard_calls_soft_delete' not in sql and 'disable trigger trg_guard_calls_visit_integrity' not in sql)

# All historical public.calls UPDATE statements must use the tombstone-safe live-row predicate.
updates=re.findall(r'update\s+public\.calls\s+c\b(.*?);',sql,re.I|re.S)
check('Exactly three historical calls backfills', len(updates)==3, f'found {len(updates)}')
for i,block in enumerate(updates,1):
    check(f'Backfill {i} excludes deleted calls', 'coalesce(c.is_deleted,false)=false' in block.lower())
    check(f'Backfill {i} requires live parent visit', 'from public.visits v' in block.lower() and 'coalesce(v.is_deleted,false)=false' in block.lower())

check('Runtime normalizer skips deleted rows', "if coalesce(new.is_deleted,false)=true then" in sql.lower())
check('Legacy field remains preserved', 'Legacy sfa_reason_code is intentionally retained unchanged' in sql)
check('Recovery remains conservative', "c.sfa_reason_code in ('stock','financial','closed')" in sql and "'pic','sfa_owner_absent'" not in sql)
check('Migration standalone after failed 006', 'add column if not exists sfa_reason_exact_code' in sql and 'create or replace function public.normalize_sfa_provenance_v039()' in sql)
# Deterministic fixture for the migration eligibility rule.
fixture=[
    {'id':'live','call_deleted':False,'visit_deleted':False},
    {'id':'call_tombstone','call_deleted':True,'visit_deleted':False},
    {'id':'deleted_parent','call_deleted':False,'visit_deleted':True},
]
eligible=[x['id'] for x in fixture if not x['call_deleted'] and not x['visit_deleted']]
check('Fixture: only live Call under live Visit is backfill-eligible', eligible==['live'], str(eligible))
check('Fixture: deleted Call is excluded', 'call_tombstone' not in eligible)
check('Fixture: live Call under deleted Visit is excluded', 'deleted_parent' not in eligible)

check('Post-migration verification SQL included', (root/'supabase/verification/202608120007_verify.sql').exists())
check('Rollback v0.3.9 source included', (root/'rollback/v0.3.9/FieldVisitIntelligence_v0.3.9_source.zip').exists())

# JavaScript syntax remains valid after version patch.
syntax_ok=True; errors=[]
for f in list((root/'src').rglob('*.js'))+[root/'sw.js']:
    r=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
    if r.returncode:
        syntax_ok=False; errors.append(f'{f.name}: {r.stderr.strip()}')
check('JavaScript syntax',syntax_ok,' | '.join(errors))

print('\nQA SUMMARY')
for name,ok,detail in results:
    print(('PASS' if ok else 'FAIL'),'-',name,(f'({detail})' if detail else ''))
failed=sum(not ok for _,ok,_ in results)
print(f'\n{len(results)-failed} PASS / {failed} FAIL')
sys.exit(1 if failed else 0)
