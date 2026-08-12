# Known Limitations — v0.4.0

- Real authenticated Supabase Migration 008 execution was not available inside the build environment; it requires Product Owner execution in the target project.
- Real iPhone/Android GPS permission, checkout GPS, camera capture, private Storage upload, and signed-photo viewing require deployed device smoke tests.
- Headless local browser smoke testing was blocked by the execution environment's localhost browser policy; browser E2E is therefore recorded as BLOCKED, not PASS.
- Admin Map depends on Leaflet/OpenStreetMap network assets. A network failure shows a map-unavailable message; raw coordinates remain available in Admin Detail and export.
- Map polylines represent check-in sequence, not actual road travelled.
- Historical v0.3.x calls have NULL rich-evidence child rows unless subsequently enriched.
- The salesman's oversized/bombing statement is observational evidence only. The app does not verify bombing without historical order data.
- Photo metadata export contains private storage paths, not embedded image files/public URLs.
- Admin Settings currently configures users, photo parameters, analysis minimum sample, and displays reason configuration. Editing dynamic reason-question schemas still requires a code/config release.
- Photo upload is queued after Call/child data. If the browser's staged photo Blob is manually cleared before upload, the photo must be selected again.
