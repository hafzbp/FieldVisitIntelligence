# Business Logic — Field Visit Intelligence v0.4.0

## 1. Business objective

The tool supports JOVIS field validation of EC/SC performance. It must distinguish what happened during a physical store visit from transactions obtained remotely, preserve the original Non-EC event, capture structured evidence behind each actual Non-EC reason, and support Admin analysis without allowing AI/model-generated business facts.

## 2. Call method

### BR-040-001 — Physical VISIT

- Trigger: JOVIS selects **VISIT** after `+ Call`.
- GPS check-in is mandatory before the call form opens.
- GPS check-out is required when a new physical call is saved.
- Route status is `JKS` or `OFF_ROUTE`.
- Result may be `EC` or `NON_EC`.
- Only VISIT calls participate in physical Visit SC and EC/SC.

### BR-040-002 — Pure BY WA

- Trigger: JOVIS selects the secondary **BY WA** option and confirms the order was obtained without physical visit.
- Result is always `EC`.
- Route status is `REMOTE`.
- Omzet is mandatory.
- GPS/dwell time and Non-EC reason are not captured.
- BY WA does not enter the numerator or denominator of Visit EC/SC.

## 3. Physical EC

- Omzet is mandatory.
- Non-EC fields are not applicable.
- Existing Kode Toko normalization is preserved: canonical format `C` + digits.

## 4. Physical Non-EC

The input order remains deliberately separated:

1. observed/actual reason;
2. structured actual-reason evidence;
3. exact SFA/E-Work reason;
4. follow-up timing fields.

This sequence reduces observer anchoring on the SFA choice.

### BR-040-003 — Exact SFA reason

Only these seven labels are valid:

- Pemilik tidak ada ditempat
- Nanti ditelpon saja
- Barang masih ada
- Toko tidak ada uang
- Toko Tutup
- Ambil dari supplier lain
- Lainnya

Historical interpreted SFA values remain preserved and use the existing legacy recovery/provenance fields.

## 5. Reason-specific evidence

Every Non-EC requires `recoverable_today = YES / NO / UNKNOWN`. Conditional evidence is then required where defined.

### PIC Tidak Tersedia

Required: PIC status. Capture expected return, likely recovery channel, best follow-up time, and notes where known.

### Toko Tutup

Required: closure status. Supported states include opening later today, remote-orderable, event closure, closed all day, permanent, or unknown. The purpose is to distinguish same-day opportunity from true no-chance closure.

### Barang Masih Ada / BMA

Required:

- at least one remaining product/SKU row;
- salesman's statement: previous order too large `YES / NO / UNKNOWN`.

Additional evidence can include stock condition, qty note, normal buying cycle, last order date, last delivery date, and explanation of the salesman statement.

**The salesman statement is not a bombing conclusion.** A final bombing/oversized-order signal requires historical order validation outside this observational claim.

### Financial

Required: temporary / structural / unknown. Additional fields include expected cash availability and partial-order possibility.

### Belum Butuh / Menolak

Required: refusal driver. Capture expected next order and normal buying cycle when known.

### Supplier/Grosir Lain / Kompetitor

Required: external-supplier driver. Capture supplier/grosir name when known.

### Harga

Required: price issue type. Capture detail such as margin, competitor price, or promotion gap.

### Kendala Produk

Required: product issue type. Capture affected product/SKU where known.

### Lainnya

Raw actual reason remains mandatory in the core Call record, plus generic recoverability and evidence fields.

### Tidak Jelas

Rich detail notes are mandatory so the unresolved condition is explicit rather than an empty bucket.

## 6. Recovery

### BR-040-004 — Preserve initial Non-EC

A post-visit success never overwrites the original physical Non-EC call. Each recovery attempt is a separate event linked to the original Call ID.

Supported channels: `WA`, `PHONE`, `REVISIT`, `OTHER`.

Supported outcomes:

- `NO_RESPONSE`
- `STILL_NON_EC`
- `RECOVERED_EC`

Recovered EC requires omzet.

Metrics remain distinct:

- **Visit EC/SC** = physical EC / physical SC.
- **Pure WA EC** = EC obtained without physical visit.
- **Recovered EC** = successful post-visit recovery of an original physical Non-EC.

## 7. Photo evidence

Photos are optional/recommended depending on reason. BMA recommends stock evidence; Toko Tutup recommends storefront evidence. Images are client-compressed and stored privately. Photo absence does not automatically invalidate a call.

## 8. Admin analysis questions

The built-in rule-based analysis addresses:

- Q1 — What is the largest Non-EC issue and how much is marked recoverable?
- Q2 — Are PIC/Toko Tutup cases showing timing/access opportunity versus lost demand?
- Q3 — Which recovery channel has the strongest observed recovery conversion?
- Q4 — How many Toko Tutup cases still have same-day opportunity?
- Q5 — For BMA, what does the captured evidence say about normal cycle versus salesman's oversized-order claim?

A minimum sample threshold is configurable. Below the threshold the result is labelled **Evidence Insufficient**, not presented as a confident conclusion.

## 9. Admin role

Admin has no Visit workflow. Admin functions are:

- Summary
- Detail Explorer
- Join Visit Map
- Rule-Based Analysis
- Settings / user administration / diagnostics

## 10. Data integrity principles

- Existing Visit ID and Call ID are preserved.
- Soft-deleted tombstones remain immutable and excluded from active analytics.
- Historical v0.3.x rows remain valid even if new v0.4.0 detail fields are NULL.
- Offline child data must not overwrite or be overwritten incorrectly during sync.
- No unsupported inference is stored as a fact.
