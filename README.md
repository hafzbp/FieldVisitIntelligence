# index-1

Static HTML application packaged for GitHub Pages.

## Contents

- `index.html` — main HTML application
- `DEPLOY_GITHUB.md` — GitHub upload and Pages deployment guide
- `SECURITY_CHECKLIST.md` — checklist before making the repo public
- `SCAN_SUMMARY.json` — automatic converter scan results
- `.gitignore` — prevents accidental upload of data/output files
- `.nojekyll` — disables Jekyll processing on GitHub Pages

## Operating model

This package is intended as a static browser app. HTML, CSS, and JavaScript are served by GitHub Pages, while the processing still runs in the user's browser unless the HTML itself calls an external API.

## Privacy / security note

Target visibility selected during conversion: **private**.

Automatic scan risk level: **MEDIUM**.

Before publishing publicly, review `SECURITY_CHECKLIST.md` and ensure no company-sensitive data, real outlets, real coordinates, real transaction values, tokens, or internal logic that should remain private are embedded in `index.html`.


