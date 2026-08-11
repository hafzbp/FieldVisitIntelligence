# Rollback

## Current release
v0.2.0

## Previous stable reference
`/rollback/v0.1.0/index.html`

## Rollback procedure

1. Preserve/export any current operational data first.
2. Replace root `index.html` with `/rollback/v0.1.0/index.html`.
3. Replace root `version.json` with `/rollback/v0.1.0/version.json`.
4. Commit the rollback to GitHub.
5. Wait for GitHub Pages redeployment.
6. Hard-refresh the production URL.
7. Confirm the visible version is v0.1.0.

## Data note
v0.2.0 was designed to preserve the legacy v0.1 storage key during migration. Rolling back application code does not itself guarantee that data created only in the newer v0.2 schema will be understood by v0.1. Export JSON before rollback when possible.
