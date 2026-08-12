# Field Visit Intelligence

**Version:** 0.4.0  
**Schema:** 202608120008  
**Frontend:** GitHub Pages  
**Backend:** Supabase Auth + Postgres + Storage  
**Primary users:** JOVIS and Admin

## Purpose

Field Visit Intelligence captures physical field-call evidence for EC/SC research while preserving a separate channel for pure WhatsApp EC. The application is designed to answer operational questions around Non-EC root causes, same-day recoverability, PIC/store availability, recovery channel effectiveness, and Barang Masih Ada (BMA) patterns.

## v0.4.0 highlights

- `+ Call` now starts with a method gate: **VISIT** is the large primary option; **BY WA** is secondary.
- VISIT retains mandatory GPS check-in/check-out and dwell time.
- BY WA records only pure WhatsApp EC and is excluded from physical Visit EC/SC.
- Non-EC now opens reason-specific structured evidence forms.
- BMA captures remaining SKU/product, stock condition, order/delivery timing, and the salesman's statement on whether the previous order was oversized. That statement is evidence only, not proof of bombing.
- Post-visit recovery is stored as a separate event; the original Non-EC is never converted into EC.
- Photo evidence can be compressed locally and synced into a private Supabase Storage bucket.
- Admin has no Visit workflow. Admin navigation is **Summary / Detail / Map / Analisis / Pengaturan**.
- Admin Detail is a row-level explorer with per-column filtering and clickable coordinates.
- Admin Map plots GPS check-ins and visit sequence by visit, with rich call information in each marker.
- Admin Analysis uses five predefined research questions and rule-based summaries. Small samples are marked as insufficient rather than forced into a conclusion.
- Detailed Excel export adds reason-detail, stock, recovery, and photo-evidence sheets.

## Exact SFA / E-Work options

The application keeps SFA selection separate from observed/actual reason. The exact SFA options are:

1. Pemilik tidak ada ditempat
2. Nanti ditelpon saja
3. Barang masih ada
4. Toko tidak ada uang
5. Toko Tutup
6. Ambil dari supplier lain
7. Lainnya

## Run / deploy

This project is a static web frontend. Deploy the repository contents to GitHub Pages after the required Supabase migrations are complete.

For an existing production database upgraded from v0.3.8/v0.3.10:

1. Confirm Migration `202608120007_exact_sfa_legacy_recovery_tombstone_safe.sql` has succeeded. If it has not, run it first.
2. Run `supabase/migrations/202608120008_rich_non_ec_admin_intelligence.sql`.
3. Run `supabase/verification/202608120008_verify.sql`.
4. Deploy the v0.4.0 frontend files.
5. Perform the production smoke tests documented in `docs/READY_TO_USE_CHECKLIST.md`.

**Do not deploy v0.4.0 frontend before Migration 008.** The frontend reads tables/columns introduced by that migration.

## Local/offline state

- Supabase is the cloud source of truth.
- IndexedDB remains the offline cache and sync queue.
- The IndexedDB database name is intentionally still `fvi_v030`; only its schema version is upgraded to preserve existing browser data.
- Parent Visit/Call queue items sync before rich-evidence child rows.
- Inbound cloud refresh does not overwrite unsynced local child edits/deletes.

## New data objects

- `calls.call_method` — `VISIT` or `WHATSAPP`
- `call_reason_details` — one structured reason-detail row per Non-EC call
- `call_stock_items` — multiple BMA stock/SKU rows per call
- `call_recovery_attempts` — post-visit WA/Phone/Revisit/Other attempts and outcome
- `call_photos` — photo metadata
- `app_settings` — Admin-managed operational settings
- private Storage bucket `call-evidence` — photo binaries

## Output

Admin detailed Excel includes the existing sheets plus:

- `11_REASON_DETAIL`
- `12_STOCK_CHECK`
- `13_RECOVERY_ATTEMPTS`
- `14_PHOTO_EVIDENCE`

`Visit EC/SC`, pure WhatsApp EC, and Recovered EC remain separate metrics.

## Project structure

```text
FieldVisitIntelligence/
├── index.html
├── version.json
├── manifest.webmanifest
├── sw.js
├── assets/
├── src/
│   ├── auth/
│   ├── config/
│   ├── data/
│   ├── domain/
│   ├── export/
│   └── ui/
├── supabase/
│   ├── migrations/
│   └── verification/
├── tests/
├── docs/
└── rollback/
```

## Important limitations

- A salesman's `oversized/bombing` statement is not treated as a verified bombing signal. Verification requires historical order data.
- Map tiles and Leaflet assets require internet access. Core local capture remains independent of map rendering.
- Real GPS permission, mobile camera capture, authenticated Supabase execution, Storage upload, and production RLS behavior require a real deployed/device smoke test; automated local tests cannot prove them.
- Historical v0.3.x rows may not contain v0.4.0 rich-evidence fields.

See `docs/` for business logic, architecture, data dictionary, deployment, security, QA, patch notes, and rollback.
