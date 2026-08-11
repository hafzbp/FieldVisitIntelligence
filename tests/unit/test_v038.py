from pathlib import Path
import re, subprocess, sys
root=Path(__file__).resolve().parents[2]
results=[]
def check(name, cond, detail=''):
    results.append((name,bool(cond),detail))
    if not cond: print('FAIL',name,detail)

cfg=(root/'src/config/app-config.js').read_text()
cloud=(root/'src/data/cloud-repository.js').read_text()
app=(root/'src/ui/app.js').read_text()
sync=(root/'src/data/sync-engine.js').read_text()
sw=(root/'sw.js').read_text()
mig=(root/'supabase/migrations/202608110005_protect_soft_delete_tombstones.sql').read_text()

check('Version 0.3.8', "APP_VERSION = '0.3.8'" in cfg)
check('Service worker cache v0.3.8', "CACHE='fvi-v0.3.8'" in sw)
check('Background pull configured', 'backgroundPullSeconds: 60' in cfg and 'startBackgroundPull' in app)
check('Cloud fetch includes visit tombstones', "sb.from('visits').select('*').order" in cloud and "visits').select('*').eq('is_deleted',false)" not in cloud)
check('Cloud fetch includes call tombstones', "sb.from('calls').select('*').order" in cloud and "calls').select('*').eq('is_deleted',false)" not in cloud)
check('Queue reconciles remote tombstones', 'reconcileQueueWithTombstones' in app and "item.payload?.is_deleted!==true" in app)
check('Remote tombstone wins pending visit', 'v=>v.is_deleted||!pendingVisit.has(v.id)' in app)
check('Remote tombstone wins pending call', 'c=>c.is_deleted||!pendingCall.has(c.id)' in app)
check('Deleted visit drafts cleaned', 'reconcileDeletedLocalState' in app and "Local.del('drafts',`call:${visitId}`)" in app)
check('Deleted selected visit cleared', 'deletedVisitIds.has(S.selectedVisitId)' in app)
check('Field cannot render tombstoned visit', "S.visits.find(x=>x.id===S.callDraft?.visit_id&&!x.is_deleted)" in app)
check('Analysis cannot render tombstoned visit', "S.visits.find(x=>x.id===S.selectedVisitId&&!x.is_deleted)" in app)
check('Focus pull implemented', "window.addEventListener('focus'" in app)
check('Visibility pull implemented', "document.addEventListener('visibilitychange'" in app)
check('Background pull avoids active field capture', "!['field','setup'].includes(S.route)" in app)
check('Deleted visits excluded from admin depot list', 'S.visits.filter(v=>!v.is_deleted).map(v=>v.depot)' in app)

check('Migration guards soft-delete tombstones', 'guard_soft_delete_tombstone' in mig and 'Only Admin may change soft-delete state.' in mig)
check('Migration makes deleted rows immutable to JOVIS', 'This record was deleted by Admin and is no longer editable.' in mig)
check('Migration protects call/visit ownership integrity', 'guard_call_visit_integrity' in mig and 'Call owner must match parent visit owner.' in mig)
check('Migration blocks active calls under deleted visit', 'Cannot add or restore an active call under a deleted visit.' in mig)
check('Migration is additive and transactional', mig.strip().startswith('-- Field Visit Intelligence v0.3.8') and 'begin;' in mig and mig.strip().endswith('commit;'))

# Logic simulation of pending-vs-tombstone merge behavior.
data_visits=[{'id':'a','is_deleted':True},{'id':'b','is_deleted':False}]
pending_visit={'a','b'}
merged=[v for v in data_visits if v['is_deleted'] or v['id'] not in pending_visit]
check('Simulation: tombstone survives pending filter', [v['id'] for v in merged]==['a'])

# Existing v0.3.7 features remain.
for needle,name in [
    ('CHECK IN CALL #','GPS check-in gate retained'),
    ('canonicalStoreCode','Kode Toko C-prefix retained'),
    ('durationSeconds','Dwell time retained'),
    ('retryAllErrors','Sync diagnostic retained')]:
    check(name, needle in app)

secret_hits=[]
for p in root.rglob('*'):
    if p.is_file() and p.suffix.lower() not in {'.png','.jpg','.jpeg','.zip'}:
        try: txt=p.read_text(errors='ignore')
        except: continue
        if re.search(r'sb_secret_[A-Za-z0-9_\-]{8,}',txt): secret_hits.append(str(p.relative_to(root)))
check('No Supabase secret key value in repo',not secret_hits,', '.join(secret_hits))

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
