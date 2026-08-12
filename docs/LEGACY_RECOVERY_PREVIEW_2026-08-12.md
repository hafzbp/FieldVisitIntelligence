# Legacy Recovery Preview — User Export 2026-08-12

Source reviewed locally: `FVI_Consolidated_Detail_2026-08-12.xls`.

This preview applies the same conservative v0.3.9 recovery rules to the exported rows. It does **not** modify the export and does **not** prove the Supabase migration has run.

## Dataset
- Visits: 2
- Calls: 71
- EC: 37
- Non-EC: 34
- EC/SC: 52.1%

## Legacy SFA recovery
- Safe auto-recovered: **23 / 34 Non-EC (67.6%)**
- Still unresolved: **11 / 34 (32.4%)**

Auto-recovered legacy categories:
- Stok Masih Tersedia: 13 → Barang masih ada
- Kendala Keuangan / Cash: 5 → Toko tidak ada uang
- Toko Tutup: 5 → Toko Tutup

Unresolved categories:
- PIC Tidak Tersedia: 5
- Lainnya: 4
- Tidak Jelas: 2

## Comparable alignment after safe recovery
Among the 23 safely recovered rows:
- MATCH: 18
- PARTIAL: 0
- MISMATCH: 5
- Match rate: 78.3%
- Mismatch rate: 21.7%

The five mismatches are all within the recovered `Barang masih ada` group: the legacy SFA interpretation was Stock, while the observed actual reason was something else.

## By JOVIS
- jovis1: 18 Non-EC → 13 safe recovered, 5 unresolved; 11 match, 2 mismatch among recovered.
- jovis2: 16 Non-EC → 10 safe recovered, 6 unresolved; 7 match, 3 mismatch among recovered.

## Manual-recovery opportunities visible in notes
At least two unresolved rows contain wording that explicitly references `Nanti ditelpon saja` / `nanti di telpon saja`. v0.3.9 may preselect this as a suggestion, but still requires Admin confirmation rather than silently rewriting the historical value.

## Interpretation guardrail
The pre-v0.3.9 export showed 78.1% exact match across the old shared taxonomy. The v0.3.9 comparable match rate above is numerically similar (78.3%) by coincidence; it uses a different, stricter denominator and should not be treated as continuity of the old metric.
