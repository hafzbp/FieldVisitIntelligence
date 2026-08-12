import assert from 'node:assert/strict';
import { buildDetailedWorkbook } from '../../src/export/exporter.js';
import { DEFAULT_REASONS } from '../../src/config/app-config.js';
const taxonomy=DEFAULT_REASONS.map(r=>({reason_code:r.code,reason_label_id:r.id,reason_label_en:r.en,reason_type:r.type,active:true,sort_order:r.sort}));
const visits=[{id:'v1',jovis_user_id:'u1',visit_date:'2026-08-12',depot:'Bandung',salesman_name:'TX2 TEST',salesman_id:'1',start_time:'2026-08-12T01:00:00Z',end_time:'2026-08-12T09:00:00Z',status:'completed',is_deleted:false}];
const calls=[
 {id:'c1',visit_id:'v1',jovis_user_id:'u1',call_method:'VISIT',outlet_id:'C1',outlet_name:'EC VISIT',route_status:'JKS',result:'EC',call_timestamp:'2026-08-12T01:10:00Z',checkin_at:'2026-08-12T01:10:00Z',checkout_at:'2026-08-12T01:15:00Z',duration_seconds:300,checkin_latitude:-6.9,checkin_longitude:107.6,checkin_accuracy_m:10,omzet:100000,is_deleted:false},
 {id:'c2',visit_id:'v1',jovis_user_id:'u1',call_method:'VISIT',outlet_id:'C2',outlet_name:'BMA',route_status:'JKS',result:'NON_EC',call_timestamp:'2026-08-12T02:00:00Z',checkin_at:'2026-08-12T02:00:00Z',checkout_at:'2026-08-12T02:03:00Z',duration_seconds:180,checkin_latitude:-6.91,checkin_longitude:107.61,checkin_accuracy_m:12,observed_reason_code:'stock',sfa_reason_code:'sfa_stock_available',sfa_reason_exact_code:'sfa_stock_available',sfa_capture_type:'EXACT',sfa_recovery_status:'EXACT_CAPTURED',reason_match_status:'MATCH',evidence:'stok masih banyak',is_deleted:false},
 {id:'c3',visit_id:'v1',jovis_user_id:'u1',call_method:'WHATSAPP',outlet_id:'C3',outlet_name:'WA ORDER',route_status:'REMOTE',result:'EC',call_timestamp:'2026-08-12T03:00:00Z',omzet:50000,is_deleted:false},
 {id:'c4',visit_id:'v1',jovis_user_id:'u1',call_method:'VISIT',outlet_id:'C4',outlet_name:'DELETED',route_status:'JKS',result:'EC',omzet:999999,is_deleted:true}
];
const profiles=[{id:'u1',display_name:'JOVIS1'}];
const reasonDetails=[{call_id:'c2',jovis_user_id:'u1',recoverable_today:'YES',preferred_recovery_channel:'WA',salesman_bombing_claim:'YES',salesman_bombing_reason:'order kemarin besar',source_version:'0.4.0'}];
const stockItems=[{id:'s1',call_id:'c2',jovis_user_id:'u1',product_name:'Nextar',stock_level:'LOT',qty_note:'2 dus'}];
const recoveryAttempts=[{id:'r1',call_id:'c2',visit_id:'v1',jovis_user_id:'u1',attempted_at:'2026-08-12T07:00:00Z',channel:'WA',outcome:'RECOVERED_EC',omzet:75000,client_created_at:'2026-08-12T07:00:00Z',client_updated_at:'2026-08-12T07:00:00Z'}];
const photos=[{id:'p1',call_id:'c2',jovis_user_id:'u1',photo_type:'STOCK',storage_path:'u1/c2/p1.webp',mime_type:'image/webp',size_bytes:123456,created_at:'2026-08-12T02:01:00Z'}];
const out=buildDetailedWorkbook({visits,calls,taxonomy,profiles,reasonDetails,stockItems,recoveryAttempts,photos});
for(const name of ['00_Summary','01_RAW_CALL_LOG','11_REASON_DETAIL','12_STOCK_CHECK','13_RECOVERY_ATTEMPTS','14_PHOTO_EVIDENCE']) assert.ok(out.xml.includes(`ss:Name="${name}"`),name);
assert.ok(out.xml.includes('Pure WA EC'));
assert.ok(out.xml.includes('Recovered EC'));
assert.ok(out.xml.includes('Nextar'));
assert.ok(out.xml.includes('u1/c2/p1.webp'));
assert.ok(out.xml.includes('WA ORDER'));
assert.ok(!out.xml.includes('999999'),'deleted call amount must not leak into workbook');
assert.match(out.filename,/FVI_Consolidated_Detail_\d{4}-\d{2}-\d{2}\.xls/);
console.log('PASS | v0.4.0 export integration assertions: 13');
