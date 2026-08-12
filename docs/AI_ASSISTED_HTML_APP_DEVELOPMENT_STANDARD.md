# AI-Assisted HTML & Application Development Standard

**Document ID:** AI-HTML-APP-STANDARD  
**Version:** 1.0.0  
**Status:** Mandatory  
**Owner:** Business Transformation / Product Owner  
**Applies to:** All HTML, web tools, applications, prototypes, patches, refactors, and AI-assisted development work  
**Last Updated:** 29 July 2026  

---

## 1. Purpose

This document defines the mandatory development standard for every HTML, web tool, or application created or modified using AI.

The objective is to ensure that every deliverable is:

- Future-proof.
- Scalable.
- Structured and maintainable.
- Understandable by both business and IT teams.
- Traceable across versions.
- Properly tested before release.
- Safe to continue, refactor, deploy, and maintain.
- Not dependent on undocumented AI-generated logic.

This document **must be shared with any AI assistant, developer, vendor, or team member before they create or patch an HTML/application**.

---

## 2. Core Principle

An HTML or application is not considered complete merely because:

- The interface opens.
- A button can be clicked.
- The requested visual change appears.
- The error is no longer visible.
- One test scenario works.

A deliverable is complete only when:

1. The business logic is explicit.
2. The IT logic and architecture are explicit.
3. The code is structured and maintainable.
4. The change is versioned.
5. The change is documented.
6. The relevant QA has been completed.
7. Regression risk has been checked.
8. Differences from the previous version are clearly explained.
9. The revised modules, files, functions, and logic are identified.
10. Known limitations and unresolved issues are disclosed.

---

## 3. Mandatory Instruction for Any AI Assistant

Before starting any HTML or application work, provide the following instruction to the AI assistant:

> You must follow the attached `AI_ASSISTED_HTML_APP_DEVELOPMENT_STANDARD.md`.
>
> Do not provide a quick patch without understanding the existing architecture, business logic, data flow, dependencies, and regression risks.
>
> Every output must be future-proof, scalable, modular, structured, maintainable, and understandable by both business and IT teams.
>
> Every creation, modification, refactor, or patch must include:
>
> 1. The revised HTML/application files.
> 2. A Markdown technical handover document.
> 3. A version number and changelog.
> 4. A comparison against the previous version.
> 5. An exact list of revised files, modules, functions, and sections.
> 6. Business-logic impact.
> 7. IT-logic and architecture impact.
> 8. QA scenarios and actual PASS/FAIL results.
> 9. Regression-check results.
> 10. Known limitations, unresolved risks, and rollback instructions.
>
> Do not declare the work complete only because the UI appears to work. Validate the relevant workflow end-to-end and confirm that existing features still work.

---

## 4. Architecture Standard

### 4.1 Future-Proof Design

Every solution must be designed for future development, not only for the current request.

The solution must anticipate:

- Additional business rules.
- Additional data columns.
- New user roles.
- Larger datasets.
- New depots, regions, countries, or business units.
- New integrations.
- Changes in configuration.
- Different deployment environments.
- Future database or API migration.
- New reporting and export requirements.
- Increased user volume.
- Changes in workflow and approval structure.

Hardcoded logic must be minimized. Business parameters should be configurable whenever practical.

### 4.2 Modular Structure

Avoid placing all logic in one monolithic HTML file unless there is a documented technical reason.

Recommended logical separation:

```text
app/
├── index.html
├── assets/
│   ├── css/
│   ├── icons/
│   └── images/
├── src/
│   ├── config/
│   ├── data/
│   ├── domain/
│   ├── services/
│   ├── state/
│   ├── ui/
│   ├── utils/
│   ├── validation/
│   └── exports/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── regression/
│   └── fixtures/
├── docs/
│   ├── README.md
│   ├── BUSINESS_LOGIC.md
│   ├── ARCHITECTURE.md
│   ├── DATA_DICTIONARY.md
│   ├── QA_REPORT.md
│   ├── CHANGELOG.md
│   └── PATCH_NOTES.md
└── version.json
```

A single-file delivery is acceptable only when required for portability. Even then, the internal code must remain clearly separated into modules or sections with explicit responsibilities.

### 4.3 Separation of Concerns

The following responsibilities must not be mixed without a clear reason:

- Business-rule calculation.
- Data ingestion.
- Data validation.
- Data transformation.
- State management.
- Map or visualization rendering.
- User-interface events.
- Export generation.
- External API integration.
- Authentication and authorization.
- Logging and error handling.
- Configuration.

### 4.4 Configuration Over Hardcoding

The following should be configurable whenever possible:

- Thresholds.
- Capacity limits.
- Scoring weights.
- Role permissions.
- API endpoints.
- File-column mappings.
- Date ranges.
- Geographic constraints.
- Visit-frequency rules.
- Working-hour assumptions.
- Export templates.
- Feature toggles.

Each configuration item must have:

- A clear name.
- A description.
- A default value.
- An allowed range or format.
- A business owner.
- Its effect on outputs.
- A validation rule.

---

## 5. Business Logic Documentation

Every HTML or application must include documentation that explains the business logic independently from the source code.

At minimum, document:

### 5.1 Business Objective

- What problem is being solved?
- Who uses the solution?
- What decision does it support?
- What output is expected?
- What business risk exists if the logic is wrong?

### 5.2 Input Data

For every input field or column, document:

- Field name.
- Business meaning.
- Data type.
- Required or optional status.
- Accepted format.
- Example value.
- Default or fallback.
- Validation.
- Source system.
- Data owner.

### 5.3 Decision Logic

For every rule, document:

- Rule ID.
- Rule name.
- Business rationale.
- Input variables.
- Formula or condition.
- Rule priority.
- Interaction with other rules.
- Output.
- Exception.
- Fallback.
- Example.
- Owner or approver.

Example:

```text
Rule ID: BR-001
Rule Name: Outlet assignment by nearest eligible hub
Condition:
- Outlet has valid latitude and longitude.
- Hub is active.
- Hub has remaining capacity.
Decision:
- Assign outlet to the eligible hub with the lowest approved travel-distance score.
Fallback:
- Use depot-level assignment if outlet coordinates are unavailable.
Exception:
- High-priority outlets may follow a separately approved ownership rule.
```

### 5.4 Edge Cases

Document expected behavior for:

- Missing files.
- Missing columns.
- Empty values.
- Invalid coordinates.
- Duplicate records.
- Inactive records.
- Unexpected categories.
- Extremely large values.
- No eligible assignment.
- Capacity overflow.
- Network or API failure.
- Partial processing.
- User cancellation.
- Export failure.
- Conflicting business rules.
- Unsupported browser or device.

### 5.5 Assumptions and Constraints

Every assumption must be visible and testable.

Examples:

- Average working hours.
- Visit duration.
- Travel-speed fallback.
- Capacity per user.
- Maximum number of records.
- Required browser.
- Required internet connection.
- API quota.
- Geographic boundary rules.
- Data freshness.

---

## 6. IT Logic and Technical Documentation

Every deliverable must explain:

### 6.1 Architecture

- Major components.
- Responsibilities of each component.
- Data flow.
- State flow.
- Event flow.
- Integration points.
- Error flow.
- Export flow.
- Deployment model.

### 6.2 Code Structure

For each major file, module, class, or function:

- Name.
- Purpose.
- Inputs.
- Outputs.
- Dependencies.
- Side effects.
- Error behavior.
- Called by.
- Calls to.
- Extension point.

### 6.3 Data Flow

The documentation must show:

```text
Input
→ Validation
→ Normalization
→ Business-rule engine
→ Assignment/calculation
→ State update
→ UI rendering
→ Export
→ Audit/logging
```

Any deviation must be explained.

### 6.4 State Management

Document:

- Source of truth.
- Temporary state.
- Persisted state.
- Reset behavior.
- Undo/redo behavior.
- Import/export synchronization.
- Cross-screen synchronization.
- Error recovery.

### 6.5 Dependencies

For every dependency, document:

- Name.
- Version.
- Purpose.
- License consideration.
- Loading source.
- Offline availability.
- Failure fallback.
- Upgrade risk.

### 6.6 Security

Check and document:

- Input sanitization.
- File-validation controls.
- Injection risk.
- Authentication.
- Authorization.
- Role-based access.
- Sensitive-data handling.
- Browser storage.
- API-key exposure.
- Logging of personal or confidential data.
- Export permissions.

### 6.7 Performance and Scalability

Document:

- Expected record volume.
- Tested record volume.
- Processing time.
- Memory behavior.
- Browser limitations.
- Rendering strategy.
- Batch or chunk processing.
- Caching.
- API rate limits.
- Performance bottlenecks.
- Scale-up approach.

---

## 7. Mandatory Markdown Deliverables

Every creation or patch must include Markdown documentation.

### 7.1 Minimum Documentation Package

At minimum, provide:

```text
README.md
PATCH_NOTES.md
QA_REPORT.md
CHANGELOG.md
```

For complex applications, also provide:

```text
BUSINESS_LOGIC.md
ARCHITECTURE.md
DATA_DICTIONARY.md
DEPLOYMENT.md
SECURITY.md
```

### 7.2 README.md

Must include:

- Product name.
- Version.
- Purpose.
- Main features.
- System requirements.
- How to run.
- Input requirements.
- Output description.
- Project structure.
- Configuration.
- Known limitations.
- Maintenance owner.
- Related documents.

### 7.3 PATCH_NOTES.md

Every patch must state:

- Previous version.
- New version.
- Patch objective.
- Problem statement.
- Root cause.
- What changed.
- Exact revised locations.
- Why each change was required.
- Business impact.
- Technical impact.
- Dependencies affected.
- Risks.
- QA performed.
- Regression result.
- Known limitations.
- Rollback procedure.

### 7.4 QA_REPORT.md

Must contain actual test evidence, not only planned test cases.

Required fields:

| Test ID | Scenario | Expected Result | Actual Result | Status | Evidence/Notes |
|---|---|---|---|---|---|
| QA-001 | Application opens | Main interface loads without critical error | Main interface loaded | PASS | Browser console checked |
| QA-002 | Invalid file uploaded | Clear validation message appears | Validation appeared | PASS | Tested missing required column |
| QA-003 | Existing export flow | Export remains consistent with UI data | Export matched | PASS | Row counts reconciled |

### 7.5 CHANGELOG.md

Use clear version history.

Example:

```markdown
## [1.2.0] - 2026-07-29

### Added
- Configurable assignment threshold.

### Changed
- Refactored traffic calculation into a dedicated service.

### Fixed
- Export mismatch after lasso reassignment.

### QA
- 18 test cases passed.
- 1 known browser limitation remains.

### Migration
- No data migration required.
```

---

## 8. Mandatory Versioning

Use semantic versioning where possible:

```text
MAJOR.MINOR.PATCH
```

### MAJOR

Use when:

- Architecture changes significantly.
- Data format becomes incompatible.
- Core business logic changes.
- Existing integrations require migration.

### MINOR

Use when:

- A new feature is added.
- A new business rule is added.
- Backward-compatible capability is introduced.

### PATCH

Use when:

- A defect is fixed.
- UI behavior is corrected.
- Performance is improved without changing expected business output.
- Documentation or validation is improved.

Every delivered file must visibly identify its version.

---

## 9. Patch Standard

A patch is not merely a code change. It is a controlled revision.

### 9.1 Before Patching

The AI or developer must:

1. Identify the current baseline version.
2. Understand the existing architecture.
3. Trace the affected workflow.
4. Identify the root cause.
5. List impacted modules.
6. Identify regression risks.
7. Define acceptance criteria.
8. Preserve a rollback copy.

### 9.2 During Patching

The AI or developer must:

- Avoid overlapping patches.
- Avoid duplicate logic.
- Avoid hidden overrides.
- Avoid unnecessary global variables.
- Avoid changing unrelated functions.
- Refactor when the root cause is architectural.
- Preserve existing valid behavior.
- Add comments only where they improve maintainability.
- Update version metadata.
- Update documentation together with the code.

### 9.3 After Patching

The AI or developer must:

1. Run targeted QA.
2. Run regression QA.
3. Run end-to-end QA for the affected workflow.
4. Compare output with the previous version.
5. Reconcile UI and export results.
6. Check browser-console errors.
7. Check performance impact.
8. Document PASS/FAIL honestly.
9. List unresolved issues.
10. Provide rollback instructions.

---

## 10. Required Version Comparison

Every revision must include a comparison table.

| Area | Previous Version | New Version | Reason | Impact |
|---|---|---|---|---|
| Assignment logic | Logic embedded in UI handler | Logic moved to assignment service | Reduce overlap and enable testing | No intended change to valid output |
| Export | Read temporary UI state | Read canonical application state | Prevent mismatch | Export now follows final saved mapping |
| Error handling | Generic alert | Structured validation result | Improve diagnosis | Clearer user feedback |
| Documentation | Not available | README, patch notes, QA report | IT handover | Easier maintenance |

The comparison must distinguish between:

- Logic changed.
- Architecture changed.
- UI changed.
- Data structure changed.
- Performance changed.
- Documentation changed.
- No intended business-output change.

---

## 11. Exact Revision Mapping

Every patch must identify the exact revised area.

Example:

```text
File: src/services/trafficService.js
Functions:
- calculateTravelMatrix()
- applyTrafficFallback()

File: src/state/store.js
Functions:
- updateOutletAssignment()
- rebuildCanonicalExportState()

File: src/exports/excelExporter.js
Functions:
- buildFinalOutletSchedule()

UI section:
- Map toolbar → Traffic button event
- Assignment panel → Manual reassignment confirmation
```

For single-file HTML, identify:

- Section name.
- Function name.
- Approximate line range.
- Event handler.
- Data object.
- CSS selector.
- Export routine.

---

## 12. QA Standard

### 12.1 QA Layers

Every relevant patch must be tested at multiple layers:

1. **Static check**  
   Syntax, missing references, duplicated functions, unreachable code.

2. **Unit check**  
   Individual formulas, validators, formatters, and decision rules.

3. **Integration check**  
   Interaction between upload, processing, map, state, and export.

4. **End-to-end check**  
   Realistic user flow from input to final output.

5. **Regression check**  
   Existing valid features remain functional.

6. **Data reconciliation**  
   Counts, totals, assignments, and exports match the canonical state.

7. **Performance check**  
   No material degradation in loading, processing, rendering, or export.

8. **Compatibility check**  
   Supported browsers and devices.

### 12.2 Minimum Mandatory Scenarios

Test as relevant:

- Application opens.
- Valid input.
- Missing file.
- Missing required column.
- Empty dataset.
- Duplicate records.
- Invalid number.
- Invalid coordinates.
- No eligible result.
- Capacity limit.
- Manual edit.
- Undo/reset.
- Re-run.
- Mode switch.
- Filter.
- Map rendering.
- Export.
- Re-import.
- Browser refresh.
- Large data.
- API failure.
- Mobile behavior.
- Previous-version workflow.

### 12.3 QA Status

Only use:

- **PASS** — expected and actual results match.
- **FAIL** — expected and actual results do not match.
- **BLOCKED** — test could not be executed, with reason.
- **NOT APPLICABLE** — scenario is irrelevant, with justification.

Never mark an unexecuted test as PASS.

---

## 13. Regression and Impact Analysis

Every patch must answer:

- Which features may be affected?
- Which data objects may change?
- Which calculations may change?
- Which exports may change?
- Which user roles may be affected?
- Which integrations may be affected?
- Which browsers may be affected?
- Can previous saved data still be used?
- Is migration required?
- Is rollback possible?
- What happens if the patch fails?

A change to one UI button may still affect:

- State.
- Assignment.
- Calculation.
- Visualization.
- Export.
- Audit trail.
- Saved configuration.
- Other modes.

Therefore, impact analysis must follow the full dependency chain.

---

## 14. Root-Cause Requirement

Do not apply repeated surface-level patches without identifying the root cause.

A valid root-cause statement must explain:

1. What failed.
2. Where it failed.
3. Why it failed.
4. Why the previous architecture allowed it.
5. What other features could be affected.
6. Why the proposed fix resolves the underlying issue.
7. What guards prevent recurrence.

Example:

```text
Symptom:
Manual outlet reassignment changed the map but not the exported file.

Root cause:
The map updated local UI state, while the exporter read a separate stale assignment object.

Architectural issue:
The application had two competing sources of truth.

Resolution:
All assignment mutations now update one canonical state store, and both the map and exporter read from that store.

Regression guard:
Integration tests reconcile map assignment counts against export assignment counts.
```

---

## 15. Rollback Standard

Every patch must include:

- Previous stable version.
- Backup location.
- Files changed.
- Configuration changed.
- Data migration performed.
- Rollback steps.
- Data-restoration steps.
- Validation after rollback.

Example:

```text
Rollback target: v1.4.2
Steps:
1. Replace the v1.4.3 application files with the v1.4.2 backup.
2. Restore `config.json` from the pre-patch backup.
3. Clear browser cache and local storage.
4. Re-run baseline QA-001 through QA-010.
5. Confirm export totals match the archived v1.4.2 evidence.
```

---

## 16. Definition of Done

A task is considered done only when all applicable items below are complete.

### Code and Architecture

- [ ] Root cause has been identified.
- [ ] Architecture has been reviewed.
- [ ] Code is modular and maintainable.
- [ ] No unnecessary duplicate logic remains.
- [ ] Configuration is separated from core logic where practical.
- [ ] Backward compatibility has been assessed.
- [ ] Version number has been updated.

### Business Logic

- [ ] Business objective is documented.
- [ ] Rules and formulas are documented.
- [ ] Assumptions are documented.
- [ ] Constraints are documented.
- [ ] Edge cases and fallback behavior are documented.
- [ ] Business impact is explained.

### Technical Documentation

- [ ] README is updated.
- [ ] PATCH_NOTES is updated.
- [ ] QA_REPORT is updated.
- [ ] CHANGELOG is updated.
- [ ] Revised modules/functions/sections are listed.
- [ ] Architecture impact is explained.
- [ ] Dependencies and risks are documented.
- [ ] Rollback instructions are provided.

### QA

- [ ] Targeted QA is completed.
- [ ] End-to-end QA is completed.
- [ ] Regression QA is completed.
- [ ] UI and export are reconciled.
- [ ] Browser-console errors are checked.
- [ ] Performance impact is checked.
- [ ] Results are recorded as PASS, FAIL, BLOCKED, or NOT APPLICABLE.
- [ ] Known limitations are disclosed.

### Handover

- [ ] Previous vs new version comparison is available.
- [ ] IT can identify exactly what changed.
- [ ] IT can understand how to add new logic.
- [ ] IT can maintain or roll back the solution.
- [ ] The final package contains code, Markdown documentation, and QA evidence.

---

## 17. Required Submission Package

Each delivery must contain a package similar to:

```text
DELIVERY_v1.2.3/
├── application/
│   └── application files
├── docs/
│   ├── README.md
│   ├── BUSINESS_LOGIC.md
│   ├── ARCHITECTURE.md
│   ├── DATA_DICTIONARY.md
│   ├── PATCH_NOTES.md
│   ├── QA_REPORT.md
│   └── CHANGELOG.md
├── tests/
│   ├── test-data/
│   └── evidence/
├── rollback/
│   └── rollback instructions or previous stable reference
└── version.json
```

For small single-file tools, the minimum package is:

```text
TOOL_v1.0.1/
├── TOOL_v1.0.1.html
├── README.md
├── PATCH_NOTES.md
├── QA_REPORT.md
└── CHANGELOG.md
```

---

## 18. AI Response Format

When an AI completes a task, its final handover must use this order:

1. **Result**
2. **Previous version**
3. **New version**
4. **Root cause**
5. **What changed**
6. **Exact revised locations**
7. **Business-logic impact**
8. **IT-logic and architecture impact**
9. **QA result**
10. **Regression result**
11. **Known limitations**
12. **Rollback**
13. **Files delivered**

The AI must not hide:

- Failed tests.
- Untested scenarios.
- Assumptions.
- Temporary workarounds.
- Remaining risks.
- Features that were not validated.

---

## 19. Team Enforcement

All team members must:

1. Share this document with any AI assistant before requesting HTML or application work.
2. Keep this document attached to the development conversation or project.
3. Reject outputs that contain only code without documentation.
4. Reject patches without version comparison.
5. Reject patches without QA evidence.
6. Reject outputs that do not identify the exact revised area.
7. Reject claims of completion based only on visual inspection.
8. Store the documentation together with the application version.
9. Preserve previous stable versions.
10. Escalate unresolved business-rule conflicts to the Product Owner.

---

## 20. Non-Compliance Conditions

A delivery is non-compliant if any of the following occurs:

- No Markdown documentation.
- No version number.
- No previous-versus-new comparison.
- No exact revision mapping.
- No QA evidence.
- QA marked PASS without execution.
- No regression assessment.
- Hidden or undocumented business rules.
- Repeated patching without root-cause analysis.
- Monolithic logic without documented justification.
- UI and export use different sources of truth.
- Known limitations are hidden.
- Rollback is not possible or not explained.
- The AI claims completion while critical tests remain blocked.

Non-compliant work must not be treated as a production-ready or IT-handover-ready deliverable.

---

## 21. Final Mandatory Statement

Every AI assistant, developer, vendor, or team member working on an HTML or application under this standard must acknowledge:

> I understand that the objective is not only to produce working code. I must produce a future-proof, scalable, structured, documented, versioned, testable, and maintainable solution. Every patch must include Markdown documentation, QA evidence, regression analysis, an exact revision map, a comparison with the previous version, known limitations, and rollback guidance.

---

**End of Standard**
