# Field Visit Intelligence

**Version:** 0.2.0  
**Deployment:** GitHub Pages  
**Primary URL:** `https://hafzbp.github.io/FieldVisitIntelligence/`

Mobile-first field application for EC/SC 90% field validation, focused on:

- capturing actual Non-EC reason vs SFA reason;
- validating reason accuracy / miscoding;
- recording follow-up intention and timing;
- capturing visit and call timestamps;
- recording EC omzet;
- allowing call corrections/editing;
- supporting local-first parallel field work across multiple observers;
- exporting/importing Visit JSON for merge and combined analysis;
- exporting business analysis outputs.

## Run

### GitHub Pages
The production application is the root-level `index.html`.

Repository structure:

```text
FieldVisitIntelligence/
├── index.html
├── version.json
├── .nojekyll
├── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BUSINESS_LOGIC.md
│   ├── CHANGELOG.md
│   ├── DATA_DICTIONARY.md
│   ├── DEPLOYMENT.md
│   ├── PATCH_NOTES.md
│   ├── QA_REPORT.md
│   └── ROLLBACK.md
└── rollback/
    └── v0.1.0/
        ├── index.html
        └── version.json
```

### Local
Open `index.html` directly in a modern browser. GitHub Pages is recommended for normal mobile use.

## Data model / storage

The application is static. Operational field data is not stored in this GitHub repository.

- Browser persistence: local browser storage.
- Parallel observers: each device records independently.
- Portable source-of-truth: Visit JSON export.
- Consolidation: Import & Merge Visit JSON files on the coordinator device.
- Business/reporting output: Excel / print-PDF as provided by the application.

Do **not** commit field-visit JSON, outlet data, salesman data, or other operational/confidential data into this repository.

## Documentation

See `/docs` for business logic, architecture, data dictionary, QA evidence, patch notes, changelog, deployment, and rollback guidance.

## Current limitations

See `docs/QA_REPORT.md` and `docs/PATCH_NOTES.md` for verified limitations and blocked tests.
