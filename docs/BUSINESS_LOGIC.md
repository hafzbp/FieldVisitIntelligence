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

## v0.3.7 — Call Check-in / Dwell Time Logic

1. A new call cannot expose the call-entry form until `CHECK IN CALL #N` succeeds.
2. Check-in triggers browser geolocation permission / acquisition.
3. If permission is denied, GPS is disabled, position is unavailable, or the request times out, the call remains locked and the observer must retry.
4. On successful check-in, the app stores check-in timestamp, latitude, longitude, and accuracy; `call_timestamp` is set equal to `checkin_at` for backward compatibility.
5. `Kode Toko` accepts numeric input only and is stored as `C` + digits without spaces.
6. On `Simpan & ke Call Berikutnya`, a second location acquisition is mandatory for new calls. The app then stores checkout timestamp/location and calculates `duration_seconds`.
7. Editing an existing call does not replace the original check-in / checkout timestamps or coordinates.
8. A visit cannot be ended while a newly checked-in call is still unfinished.
