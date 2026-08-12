import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildDetailedWorkbook } from '../../src/export/exporter.js';
import { DEFAULT_REASONS } from '../../src/config/app-config.js';

const taxonomy=DEFAULT_REASONS.map(r=>({reason_code:r.code,reason_label_id:r.id,reason_label_en:r.en,reason_type:r.type,sort_order:r.sort,active:true}));
const visits=[{id:'v1',jovis_user_id:'u1',visit_date:'2026-08-12',depot:'TEST',salesman_name:'TX2 TEST',salesman_id:'1',start_time:'2026-08-12T08:00:00+07:00',end_time:'2026-08-12T09:00:00+07:00',status:'completed',is_deleted:false}];
const calls=[
  {id:'c1',visit_id:'v1',jovis_user_id:'u1',result:'EC',omzet:100000,outlet_id:'C1',outlet_name:'A',route_status:'JKS',is_deleted:false,duration_seconds:600,checkin_at:'2026-08-12T08:00:00+07:00',checkout_at:'2026-08-12T08:10:00+07:00'},
  {id:'c2',visit_id:'v1',jovis_user_id:'u1',result:'NON_EC',outlet_id:'C2',outlet_name:'B',route_status:'JKS',is_deleted:false,observed_reason_code:'stock',sfa_reason_code:'stock',sfa_reason_exact_code:'sfa_stock_available',sfa_capture_type:'LEGACY',sfa_recovery_status:'AUTO_RECOVERED',evidence:'stok masih ada',duration_seconds:300,checkin_at:'2026-08-12T08:20:00+07:00',checkout_at:'2026-08-12T08:25:00+07:00'},
  {id:'c3',visit_id:'v1',jovis_user_id:'u1',result:'NON_EC',outlet_id:'C3',outlet_name:'Deleted',route_status:'JKS',is_deleted:true,observed_reason_code:'stock',sfa_reason_code:'stock'}
];
const profiles=[{id:'u1',display_name:'JOVIS TEST'}];
const out=buildDetailedWorkbook({visits,calls,taxonomy,profiles,language:'id'});
assert.ok(out.filename.endsWith('.xls'));
assert.ok(out.xml.includes('Field Visit Intelligence v0.3.10'));
assert.ok(out.xml.includes('10_SFA_RECOVERY'));
assert.ok(out.xml.includes('Barang masih ada'));
assert.ok(!out.xml.includes('Deleted'));
fs.writeFileSync('tests/evidence/v0.3.10_export_fixture.xml',out.xml);
console.log('PASS - v0.3.10 synthetic detailed export generated; deleted call excluded');
