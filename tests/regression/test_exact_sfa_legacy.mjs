import assert from 'node:assert/strict';
import { DEFAULT_REASONS, SAFE_LEGACY_SFA_MAP } from '../../src/config/app-config.js';
import { classifyReason, analysisReasonStatus, safeLegacyExactCode, normalizedRecoveryStatus, exactSfaCode } from '../../src/domain/reason-engine.js';

const sfa=DEFAULT_REASONS.filter(x=>x.type==='sfa');
assert.deepEqual(sfa.map(x=>x.id),[
  'Pemilik tidak ada ditempat',
  'Nanti ditelpon saja',
  'Barang masih ada',
  'Toko tidak ada uang',
  'Toko Tutup',
  'Ambil dari supplier lain',
  'Lainnya'
]);
assert.equal(sfa.length,7);
assert.equal(DEFAULT_REASONS.filter(x=>x.type==='observed').length,10);
assert.deepEqual(SAFE_LEGACY_SFA_MAP,{stock:'sfa_stock_available',financial:'sfa_no_cash',closed:'sfa_store_closed'});

const base={result:'NON_EC',observed_reason_code:'stock',contributing_factor:null,sfa_reason_code:'sfa_stock_available',sfa_reason_exact_code:'sfa_stock_available',sfa_capture_type:'EXACT',sfa_recovery_status:'EXACT_CAPTURED'};
assert.equal(exactSfaCode(base),'sfa_stock_available');
assert.equal(classifyReason(base),'MATCH');
assert.equal(analysisReasonStatus(base),'MATCH');
assert.equal(classifyReason({...base,observed_reason_code:'financial'}),'MISMATCH');
assert.equal(classifyReason({...base,observed_reason_code:'financial',contributing_factor:'stock'}),'PARTIAL');
assert.equal(analysisReasonStatus({...base,sfa_reason_code:'sfa_call_later',sfa_reason_exact_code:'sfa_call_later'}),'NON_CAUSAL');
assert.equal(analysisReasonStatus({...base,sfa_reason_code:'sfa_other',sfa_reason_exact_code:'sfa_other'}),'TAXONOMY_GAP');

const legacyStock={result:'NON_EC',sfa_reason_code:'stock',observed_reason_code:'stock'};
assert.equal(safeLegacyExactCode(legacyStock),'sfa_stock_available');
assert.equal(normalizedRecoveryStatus(legacyStock),'AUTO_RECOVERED');
assert.equal(analysisReasonStatus(legacyStock),'MATCH');
const legacyPic={result:'NON_EC',sfa_reason_code:'pic',observed_reason_code:'pic'};
assert.equal(safeLegacyExactCode(legacyPic),null);
assert.equal(normalizedRecoveryStatus(legacyPic),'UNRESOLVED');
assert.equal(analysisReasonStatus(legacyPic),'UNRESOLVED');

console.log('PASS - exact SFA + legacy recovery logic retained in v0.3.10');
