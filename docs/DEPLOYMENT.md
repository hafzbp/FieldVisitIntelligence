# Deployment — GitHub Pages

## Target repository

`hafzbp/FieldVisitIntelligence`

Production URL:

`https://hafzbp.github.io/FieldVisitIntelligence/`

## Recommended deployment method — GitHub Web

1. Extract the GitHub-ready ZIP locally.
2. Open the `FieldVisitIntelligence` repository on GitHub.
3. Open the repository root (the same level where the existing `index.html` lives).
4. Choose **Add file → Upload files**.
5. Drag **the contents inside** `FieldVisitIntelligence_GitHubReady_v0.2.0/` into the repository root. Do not upload the outer folder as one nested directory.
6. Confirm that root `index.html` is being replaced by the v0.2.0 file.
7. Commit the changes, preferably with message: `Release Field Visit Intelligence v0.2.0`.
8. Wait for GitHub Pages deployment to finish.
9. Open the production URL and hard-refresh once if the prior version is cached.
10. Confirm the UI shows `v0.2.0`.

## Files that must be in repository root

- `index.html` — required application entry point.
- `version.json` — release metadata.
- `.nojekyll` — ensures Pages serves the repository as a plain static site without Jekyll processing.
- `README.md` — repository handover/documentation entry.

## Supporting folders

- `/docs` — technical/business handover and QA evidence.
- `/rollback/v0.1.0` — previous stable application reference.

## GitHub Pages configuration

If Pages is already working for this repository, do not change its settings merely for this release.

If configuration is needed, publish from the repository branch/folder that contains root `index.html` (normally the configured main branch, root folder).

## Data safety before deploying a replacement

Application updates do not intentionally delete the v0.1 storage key, and v0.2 contains migration logic. Nevertheless, before a field-critical deployment:

1. Export any important active visit/backup data from the current application.
2. Deploy v0.2.0.
3. Re-open using the same browser/origin.
4. Verify existing data is visible before continuing field capture.

## Do not upload operational data to GitHub

Do not commit exported field JSON, Excel reports, outlet master data, observer/salesman operational datasets, or any confidential business data into the public/static repository.
