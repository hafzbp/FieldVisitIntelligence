# Ready-to-Use Checklist — v0.3.8

## Deployment
1. Supabase SQL Editor → run `202608110005_protect_soft_delete_tombstones.sql`.
2. Confirm `Success. No rows returned`.
3. Upload/replace GitHub repository contents with v0.3.8.
4. Confirm GitHub Pages header shows `v0.3.8`.
5. Close/reopen old mobile tabs once so the new service worker is active.

## Final smoke test
1. Login JOVIS → create a test Visit.
2. Check-in Call → allow GPS → save 1 EC with omzet.
3. Login Admin → confirm Visit appears.
4. Admin deletes the test Visit.
5. Return to JOVIS Home and refocus/reload → Visit must disappear.
6. Admin/JOVIS Sync diagnostic must show `0 error`.
7. Admin export consolidated Excel once.

If all seven smoke-test items pass, v0.3.8 is the recommended field-use baseline.
