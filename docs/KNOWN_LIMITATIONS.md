# Known Limitations

1. Delivered build has placeholder Supabase connection values.
2. Real Auth/RLS/offline-sync QA is blocked until a Supabase project is connected.
3. Admin user creation inside the app is intentionally deferred; pilot users are created in Supabase Dashboard.
4. Admin dashboard refreshes periodically/on demand; it does not subscribe to realtime events.
5. Actual post-Non-EC recovery result is not yet linked to a later call.
6. Custom actual reasons are deliberately not auto-clustered. They remain raw for later ChatGPT analysis and business taxonomy approval.
7. `@supabase/supabase-js` is loaded from a pinned CDN version. A future hardened build may vendor/package the dependency.
