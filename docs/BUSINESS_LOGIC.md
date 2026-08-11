# Business Logic

## Objective A — Actual Non-EC reason validation
Observer captures the actual primary reason before recording the SFA reason selected by the salesman.

Classification:
- MATCH: SFA reason = primary observed reason.
- PARTIAL: SFA reason = contributing factor, but not primary reason.
- MISMATCH: SFA reason differs from primary reason and is not the contributing factor.
- UNCLEAR: insufficient evidence / reason unavailable.

## Objective B — Taxonomy discovery
`Other / Lainnya` is not treated as a terminal analytical bucket.
When Other is selected, `custom_real_reason` is mandatory and the raw text is preserved.
The Admin export exposes every custom reason and evidence row so downstream analysis can cluster repeated field language and propose a new granular E-Work taxonomy.

The app does not automatically invent or semantically merge new reasons in v0.3.0.

## Objective C — Follow-up validation
Non-EC captures planned revisit, whether an earlier revisit is possible, and the operational reason/signal determining follow-up timing.
Actual recovery outcome is reserved for a future version.

## EC
Omzet is mandatory whenever Result = EC.
The database also enforces non-null omzet for EC.

## One active visit
One authenticated JOVIS account may have at most one active visit.
A partial unique index enforces this server-side.

## Editing
JOVIS may edit their own completed visits/calls.
Admin may edit all visible JOVIS data.
Call updates produce server-side audit history.
