# Architecture — Field Visit Intelligence v0.4.0

## Deployment model

```text
JOVIS / Admin browser
        │
        ├─ UI + domain rules (GitHub Pages)
        ├─ IndexedDB offline cache / draft / sync queue
        │
        └─ Supabase
            ├─ Auth
            ├─ Postgres + RLS
            └─ Private Storage: call-evidence
```

## Source of truth

- Cloud canonical source: Supabase Postgres.
- Offline operational source while disconnected: IndexedDB.
- Sync queue records mutations and retries them when online.
- The local IndexedDB database name remains `fvi_v030`; DB version moves to 2 so existing browser data is upgraded rather than abandoned.

## Main modules

| Module | Responsibility |
|---|---|
| `src/ui/app.js` | Role-aware routes, JOVIS capture, Admin workspace, validation, local orchestration |
| `src/config/app-config.js` | Version, feature flags, exact SFA and observed taxonomy defaults |
| `src/domain/reason-detail-config.js` | Dynamic reason-specific question schema |
| `src/domain/admin-intelligence.js` | Rule-based Admin KPIs and Q1–Q5 summaries |
| `src/domain/analysis-engine.js` | Existing EC/SC/reason analysis with Visit-only denominator |
| `src/data/local-db.js` | IndexedDB schema and persistence |
| `src/data/sync-engine.js` | Queue ordering, retry, dependency ordering |
| `src/data/cloud-repository.js` | Supabase table/storage operations and payload sanitization |
| `src/data/media-service.js` | Client-side image compression, offline staging, Storage upload |
| `src/export/exporter.js` | Multi-sheet detailed XML Spreadsheet export |

## Data flow — physical VISIT

```text
+ Call
→ VISIT
→ mandatory GPS check-in
→ outlet + JKS/OFF route
→ EC or Non-EC
→ conditional reason evidence if Non-EC
→ exact SFA reason if Non-EC
→ mandatory GPS checkout
→ canonical local Call save
→ child detail/stock/photo queue
→ Supabase sync
```

## Data flow — pure WhatsApp EC

```text
+ Call
→ BY WA
→ confirmation: no physical visit
→ outlet + omzet
→ Call(method=WHATSAPP, result=EC, route=REMOTE)
→ local save
→ Supabase sync
```

## Data flow — recovery

```text
Existing physical NON_EC Call
→ + Update Recovery
→ channel + outcome + optional notes
→ omzet required for RECOVERED_EC
→ new call_recovery_attempts row
→ original Call remains NON_EC
```

## Sync dependency order

Queued entities are processed in this order:

1. Visit
2. Call
3. Reason Detail
4. Stock Item
5. Recovery Attempt
6. Photo upload

This prevents a child row from reaching Supabase before its parent Call exists.

Inbound refresh also excludes cloud child rows whose local IDs are still pending in the queue, preventing stale cloud data from overwriting unsynced offline edits/deletes.

## Soft delete / tombstones

v0.4.0 retains v0.3.8 tombstone semantics. Migration 008 avoids a row-level backfill of `calls.call_method`; the new column is added with `NOT NULL DEFAULT 'VISIT'` in DDL so historical tombstones are not updated through the runtime tombstone guard.

## Admin Map

Leaflet 1.9.4 + OpenStreetMap tiles are loaded at runtime. Only physical VISIT calls with valid check-in coordinates are plotted. Sequence numbering and polylines are grouped by Visit ID; the line represents check-in sequence, **not the actual travelled road path**.

## Photo architecture

- Browser selects/captures image.
- Image is compressed to WebP locally.
- Recompression has a ~950 KB safety target under the 1 MB bucket limit.
- Blob is staged in IndexedDB (`photoBlobs`) when offline.
- Queue uploads to `call-evidence/<user>/<call>/<photo>.webp`.
- Metadata is stored in `call_photos`.
- Admin reads photos through short-lived signed URLs.

## Scalability

The design uses child tables rather than adding repeating SKU/photo/recovery columns to `calls`. This supports multiple SKU items, multiple recovery attempts, and multiple photos per call without changing the Call grain.
