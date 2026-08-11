# BUSINESS LOGIC — v0.2.0

## Business Objective
Support EC/SC 90% field validation through two primary objectives:
1. Validate whether SFA Non-EC reasons represent the actual outlet condition.
2. Record what follow-up is planned after a Non-EC event and why that timing is chosen.

The tool must capture facts first and avoid treating suspected miscoding as proven misconduct.

## Core Workflow
```text
Actual outlet event
-> Actual Non-EC reason
-> Raw custom reason if Other
-> Optional contributing factor
-> Evidence
-> SFA reason selected independently
-> Match classification
-> Follow-up plan
-> Timing feasibility / timing reason
-> Save
-> Analysis / evidence trace
```

## Rule BR-001 — Call Timestamp
When EC or Non-EC is first selected, `callAt` is set automatically. Editing a saved call does not replace the original `callAt`; edits create `lastEditedAt`.

## Rule BR-002 — EC Omzet
If result is EC, observer may enter `orderValue`. It is optional. Only entered positive values contribute to Total Omzet and Avg Omzet / EC.

## Rule BR-003 — Actual Reason Before SFA Reason
For Non-EC, the actual observed reason is captured before SFA reason to reduce observer anchoring to SFA classification.

## Rule BR-004 — Other / Lainnya
If actual primary reason is `Other`, `customObservedReason` is mandatory.
- The raw text is preserved.
- Analysis normalizes lowercase and repeated whitespace for counting.
- The raw custom label appears as a separate actual-reason category in the mismatch matrix and `New / Unmapped Actual Reasons` report.

Example:
`Produk slow moving` and `produk   slow moving` are grouped under one normalized count while the displayed label remains a raw field label.

## Rule BR-005 — Contributing Factor
A contributing factor is optional and hidden by default. It is not treated as the primary business reason.

## Rule BR-006 — Reason Classification
For Non-EC:
- **MATCH:** SFA reason ID = actual primary reason ID.
- **PARTIAL:** SFA reason differs from primary but equals the optional contributing-factor reason ID.
- **MISMATCH:** SFA reason differs from both primary and contributing-factor reason.
- **UNCLEAR:** actual primary or SFA reason is missing/unclear.

`Other` can be a Match when actual category is Other and SFA category is Other; the raw custom actual reason remains separately visible so missing taxonomy can still be discovered.

## Rule BR-007 — Follow-up
The observer records:
- D+1
- D+2
- D+3
- Within 1 Week
- Next JKS
- WA / Phone
- No Follow-up
- Unknown

`Can Revisit Earlier?` records whether an earlier revisit is operationally feasible. `Reason for Follow-up Timing` records why the selected timing is used (JKS, PIC request, stock, workload, distance, outlet information, etc.).

## Rule BR-008 — Draft Persistence
Each active visit has an auto-saved draft in localStorage. Text input and selection changes update the draft. Normal browser restart can restore the draft from the same origin/browser profile.

## Rule BR-009 — Multi-Observer Merge
Each device has a generated `deviceId`; each visit and call has a unique ID.
- New Visit ID -> append visit.
- Existing Visit ID -> merge calls by Call ID.
- Same Call ID on both copies -> record with the later `updatedAt` wins.
- Imported visits from another device do not become the current device's active visit.

## Rule BR-010 — Findings
Auto-conclusions are rule-based. They may identify:
- insufficient sample,
- low/medium/high reason reliability,
- SFA reason with elevated mismatch,
- possible broad/default classification,
- inconsistent PIC follow-up timing,
- concentration on Next JKS,
- newly observed custom reasons.

The application explicitly does not infer intentional miscoding from mismatch alone.

## Business Risk if Logic is Wrong
- False accusation that salesmen are miscoding reasons.
- Incorrect redesign of SFA taxonomy.
- Incorrect follow-up trial prioritization.
- Loss of field evidence or attribution across observers.

Therefore raw evidence, raw custom reasons, visit/call IDs, timestamps, and edit timestamps are retained in exports.
