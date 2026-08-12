# Security — v0.4.0

## Authentication and authorization

Supabase Auth remains mandatory. New v0.4.0 tables use RLS:

- JOVIS can select/write child records owned by their own Call.
- Admin can read/write across JOVIS records according to `public.is_admin()`.
- A database integrity trigger verifies child owner equals the parent Call owner and blocks writes below a deleted parent Call.

## Supabase keys

Only the Supabase publishable key is present in browser source. Secret/service-role/database credentials must never be embedded in GitHub Pages.

## Photo evidence

- Storage bucket: `call-evidence`.
- Bucket is private.
- Object path starts with authenticated user ID.
- JOVIS can upload/select/delete objects in their own folder under policy; Admin can read/delete evidence according to policy.
- Admin photo viewing uses short-lived signed URLs.
- Client compression targets <950 KB to remain below the 1 MB bucket limit.

## Sensitive data

Photo evidence may contain store information. Capture only business-relevant evidence. Do not use photo evidence to collect unnecessary personal information. Exports contain private Storage paths but not public URLs.

## Input handling

UI output uses HTML escaping for user-entered text. Supabase table access uses structured client operations rather than string-built SQL. Kode Toko is normalized to `C` plus digits.

## Tombstones

Soft-deleted Visit/Call records are not restored by v0.4.0 sync. Rich child queues linked to tombstoned Calls are removed from local queue reconciliation and database child writes are blocked.
