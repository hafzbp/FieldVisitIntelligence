# v0.4.0 Production Smoke Checklist

Do this after Migration 008 + verification and after frontend deployment.

## Database

- [ ] Migration 007 previously succeeded.
- [ ] Migration 008 completed without error.
- [ ] Verification 008 returns expected tables/constraints/bucket and no integrity error.

## JOVIS — VISIT

- [ ] Existing logged-in JOVIS can open the upgraded app without losing historical visit/call data.
- [ ] `+ Call` shows large primary **VISIT** and secondary **BY WA**.
- [ ] VISIT cannot proceed without GPS permission/check-in.
- [ ] Kode Toko stores `C` + digits.
- [ ] EC requires omzet and saves check-in/out GPS + duration.
- [ ] Non-EC requires actual reason, rich reason detail, and exact SFA reason.
- [ ] BMA requires at least one product/SKU plus salesman oversized-order claim.
- [ ] Photo evidence can be captured and later viewed by Admin.

## JOVIS — BY WA

- [ ] BY WA requires confirmation that no physical visit occurred.
- [ ] BY WA requires outlet and omzet.
- [ ] BY WA saves as EC / REMOTE with no GPS/dwell time.
- [ ] BY WA does not increase physical Visit SC.

## Recovery

- [ ] A physical Non-EC marked recoverable appears in Recovery Pending.
- [ ] Add a WA/Phone/Revisit attempt.
- [ ] Recovered EC requires omzet.
- [ ] Original call remains NON_EC after recovery.

## Admin

- [ ] Admin navigation has Summary / Detail / Map / Analisis / Pengaturan and no Visit workflow.
- [ ] Summary separates Visit EC/SC, Pure WA EC, and Recovered EC.
- [ ] Detail filters work by header and Lat/Long opens maps.
- [ ] Detail drawer shows reason detail, stock, recovery, and photo evidence.
- [ ] Map plots physical GPS calls and sequence grouped by Visit.
- [ ] Analysis displays Q1–Q5 and labels insufficient sample correctly.
- [ ] Export contains sheets 11–14 and totals reconcile with Admin Summary.

## Sync/regression

- [ ] JOVIS offline queue can sync after reconnection.
- [ ] Admin soft-delete still disappears from JOVIS after refresh and is not resurrected.
- [ ] No browser console critical errors in tested flows.
