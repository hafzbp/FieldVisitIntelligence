import assert from 'node:assert/strict';
import { buildAdminIntelligence } from '../../src/domain/admin-intelligence.js';
import { reasonDetailSchema, emptyReasonDetail } from '../../src/domain/reason-detail-config.js';
import { analyze } from '../../src/domain/analysis-engine.js';
import { DEFAULT_REASONS } from '../../src/config/app-config.js';

const tax=DEFAULT_REASONS.map(r=>({reason_code:r.code,reason_label_id:r.id,reason_label_en:r.en,reason_type:r.type,active:true,sort_order:r.sort}));
const visits=[{id:'v1',jovis_user_id:'u1',visit_date:'2026-08-12',depot:'Bandung',salesman_name:'TX2',status:'completed',is_deleted:false}];
const calls=[
 {id:'c1',visit_id:'v1',jovis_user_id:'u1',call_method:'VISIT',result:'EC',omzet:100000,route_status:'JKS',is_deleted:false,duration_seconds:300},
 {id:'c2',visit_id:'v1',jovis_user_id:'u1',call_method:'VISIT',result:'NON_EC',observed_reason_code:'stock',sfa_reason_exact_code:'sfa_stock_available',route_status:'JKS',is_deleted:false,duration_seconds:180},
 {id:'c3',visit_id:'v1',jovis_user_id:'u1',call_method:'WHATSAPP',result:'EC',omzet:50000,route_status:'REMOTE',is_deleted:false},
];
const reasonDetails=[{call_id:'c2',jovis_user_id:'u1',recoverable_today:'YES',salesman_bombing_claim:'YES'}];
const stocks=[{id:'s1',call_id:'c2',jovis_user_id:'u1',product_name:'Nextar',stock_level:'LOT'}];
const recovery=[{id:'r1',call_id:'c2',visit_id:'v1',jovis_user_id:'u1',attempted_at:'2026-08-12T14:00:00Z',channel:'WA',outcome:'RECOVERED_EC',omzet:75000}];
const intel=buildAdminIntelligence({visits,calls,taxonomy:tax,reasonDetails,stockItems:stocks,recoveryAttempts:recovery,photos:[],minDirectionalSample:1});
assert.equal(intel.visitSc,2,'pure WA must not enter Visit SC');
assert.equal(intel.visitEc,1);
assert.equal(intel.visitEcsc,50);
assert.equal(intel.waEc,1);
assert.equal(intel.waRevenue,50000);
assert.equal(intel.recoveredEc,1);
assert.equal(intel.recoveredRevenue,75000);
assert.equal(intel.totalSuccessfulOrders,3);
assert.equal(intel.bombing.YES,1);
assert.equal(intel.stockProductCounts.Nextar,1);
assert.equal(intel.questions.length,5);
assert.equal(intel.channels.WA.conversion,100);
const a=analyze(visits,calls,tax);
assert.equal(a.sc,2,'analysis engine must use physical Visit only');
assert.equal(a.ec,1);
assert.equal(a.ecsc,50);
assert.equal(reasonDetailSchema('stock').stockItems,true);
assert.equal(reasonDetailSchema('closed').fields.includes('closed_status'),true);
assert.equal(reasonDetailSchema('pic').fields.includes('pic_status'),true);
assert.equal(emptyReasonDetail('c9','u9').call_id,'c9');
console.log('PASS | v0.4.0 domain executable assertions: 17');
