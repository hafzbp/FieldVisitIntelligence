# Data Dictionary — v0.4.0 Additions

This file documents fields introduced or materially reinterpreted in v0.4.0. Existing v0.3.x fields remain unchanged unless stated.

## `calls`

| Field | Type | Meaning | Required |
|---|---|---|---|
| `call_method` | text | `VISIT` physical call or `WHATSAPP` pure remote EC | yes |
| `route_status` | text | `JKS`, `OFF_ROUTE`, or `REMOTE`; `REMOTE` is reserved for pure WhatsApp EC | yes |
| `result` | text | Initial physical result or pure WhatsApp EC result | yes |
| `checkin_*` / `checkout_*` | timestamp/GPS | Physical VISIT evidence; NULL for WHATSAPP | conditional |

## `call_reason_details`

One row per Non-EC Call ID.

| Field | Meaning |
|---|---|
| `recoverable_today` | YES / NO / UNKNOWN same-day order chance |
| `preferred_recovery_channel` | WA / PHONE / REVISIT / OTHER / UNKNOWN / NONE |
| `best_followup_time` | Human-readable best follow-up time |
| `pic_status` | Temporary / remote-orderable / unreachable / other / unknown |
| `pic_expected_return` | Expected PIC return |
| `closed_status` | Open later / remote-orderable / event / all-day / permanent / unknown |
| `closed_expected_open` | Expected opening time/date |
| `financial_status` | Temporary / structural / unknown cash issue |
| `cash_available_when` | Expected cash availability |
| `partial_order_possible` | YES / NO / UNKNOWN |
| `refusal_driver` | Stock cycle / price / product / space / low demand / other / unknown |
| `expected_next_order` | Expected next order timing |
| `price_issue_type` | RRP high / margin low / competitor cheaper / promo gap / other / unknown |
| `price_detail` | Free detail on price/margin/promo |
| `product_issue_type` | Quality / assortment / slow moving / expired risk / pack size / damaged / other / unknown |
| `affected_products` | Product/SKU affected |
| `external_supplier_name` | Supplier/grosir named by observer/salesman |
| `external_supplier_driver` | Price / TOP / availability / min order / delivery / other / unknown |
| `normal_buying_cycle` | Captured buying-cycle statement |
| `last_order_date` | Last order date if known |
| `last_delivery_date` | Last delivery date if known |
| `salesman_bombing_claim` | YES / NO / UNKNOWN statement whether previous order was too large |
| `salesman_bombing_reason` | Explanation of that statement |
| `detail_notes` | Additional observed detail |
| `source_version` | Capture schema version |

## `call_stock_items`

Multiple rows per call.

| Field | Meaning |
|---|---|
| `product_name` | Remaining product/SKU name |
| `stock_level` | LOT / MEDIUM / LOW / OUT / UNKNOWN |
| `qty_note` | Indicative quantity or free description |
| `notes` | Additional stock note |

## `call_recovery_attempts`

Multiple rows per original Non-EC call.

| Field | Meaning |
|---|---|
| `attempted_at` | Recovery attempt timestamp |
| `channel` | WA / PHONE / REVISIT / OTHER |
| `outcome` | NO_RESPONSE / STILL_NON_EC / RECOVERED_EC |
| `omzet` | Mandatory only for RECOVERED_EC |
| `notes` | Recovery evidence/notes |

## `call_photos`

Photo metadata only; binary is in private Storage.

| Field | Meaning |
|---|---|
| `photo_type` | STOCK / STOREFRONT / OTHER |
| `storage_path` | Private bucket object path |
| `caption` | Optional caption |
| `mime_type` | Compressed image MIME |
| `size_bytes` | Compressed object size |

## `app_settings`

| Key | Meaning |
|---|---|
| `photo_config` | max image dimension, quality, max photos/call |
| `analysis_rules` | rule-based analysis thresholds |

## Derived metrics

- **Visit SC**: active, non-deleted `calls` with `call_method=VISIT`.
- **Visit EC**: Visit SC with `result=EC`.
- **Visit EC/SC**: Visit EC / Visit SC.
- **Pure WA EC**: active `call_method=WHATSAPP` calls.
- **Recovered EC**: unique original call IDs with at least one recovery attempt `RECOVERED_EC`.
- **Bombing claim**: salesman statement only; not a validated derived bombing signal.
