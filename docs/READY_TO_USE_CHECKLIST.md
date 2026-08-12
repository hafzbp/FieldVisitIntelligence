# Ready-to-Use Checklist — Field Visit Intelligence v0.4.1

v0.4.1 has **no new SQL migration**. Database schema remains Migration 008.

## Deploy
- [ ] Confirm Migration 007 previously succeeded.
- [ ] Confirm Migration 008 previously succeeded.
- [ ] Replace GitHub Pages frontend files with v0.4.1 package contents.
- [ ] Wait for GitHub Pages deployment to finish.
- [ ] Open `https://hafzbp.github.io/FieldVisitIntelligence/`.
- [ ] If the old blank page remains, perform one hard refresh (`Ctrl+Shift+R`) or close/reopen the mobile browser tab.
- [ ] Confirm login screen/application shell renders and shows v0.4.1.

## JOVIS smoke
- [ ] Login JOVIS.
- [ ] Existing historical Visit/Call data remains visible.
- [ ] Start/continue a VISIT and confirm GPS check-in gate.
- [ ] Confirm BY WA secondary option works.
- [ ] Save one test only if operationally acceptable; otherwise do not create production test data.

## Admin smoke
- [ ] Login Admin.
- [ ] Admin has Summary / Detail / Map / Analisis / Pengaturan and no Visit workflow.
- [ ] Detail rows load.
- [ ] Lat/Long links are clickable where GPS exists.
- [ ] Map loads for rows with GPS.
- [ ] Export remains available.

## If blank white page persists
Open Chrome DevTools → Console and send the first red error line. Do not rerun migrations solely for a blank frontend page; v0.4.1 does not require a database migration.
