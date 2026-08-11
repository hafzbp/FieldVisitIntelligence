# Security Checklist

Use this before pushing to GitHub, especially before making the repo public.

## Must not be committed

- Real Excel source data
- Outlet/customer master data
- Real latitude/longitude data
- Real salesman names or IDs
- Real transaction, omzet, CB, EC, EPB, ROA data
- Company credentials, tokens, API keys, secrets, passwords
- Exported HTML that embeds confidential run results
- Internal company logo/branding unless allowed

## Automatic scan summary

- Risk level: MEDIUM
- Input file: index (1).html
- Input size: 156.9 KB
- fetch(): 0
- XMLHttpRequest: 0
- axios: 0
- Google/Drive references: 0
- external URLs: 0
- localStorage references: 6
- IndexedDB references: 0
- possible embedded data/business terms: true

## Manual checks

- [ ] Open `index.html` in a text editor and search for real outlet names.
- [ ] Search for real salesmen/MPP names.
- [ ] Search for `latitude`, `longitude`, `lat`, `lon`.
- [ ] Search for `omzet`, `revenue`, `CB`, `EC`, `ROA`, `EPB`.
- [ ] Search for `token`, `secret`, `password`, `apiKey`, `access_token`.
- [ ] Open browser DevTools → Network while using the app. Confirm no unexpected request is sent.
- [ ] Test with dummy data only before public sharing.

## Recommendation

If risk level is HIGH, keep the repository private or create a sanitized demo version first.
