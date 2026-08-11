# Data Dictionary

## visits
| Field | Meaning |
|---|---|
| id | UUID visit |
| jovis_user_id | Authenticated owner |
| visit_date | Business visit date |
| depot | Area / depot |
| salesman_name | Salesman observed |
| salesman_id | Optional salesman ID |
| start_time | Captured when visit starts |
| end_time | Captured when visit ends |
| status | active / completed |
| client_created_at | Client creation timestamp |
| client_updated_at | Latest client edit timestamp |

## calls
| Field | Meaning |
|---|---|
| id | UUID call |
| visit_id | Parent visit |
| jovis_user_id | Record owner |
| outlet_id | Optional outlet ID |
| outlet_name | Outlet name |
| route_status | JKS / OFF_ROUTE |
| result | EC / NON_EC |
| call_timestamp | First saved call-result timestamp; preserved during editing |
| omzet | Mandatory for EC |
| observed_reason_code | Primary actual Non-EC reason |
| custom_real_reason | Required raw actual reason when Other is chosen |
| contributing_factor | Optional secondary factor |
| evidence | Factual field evidence |
| sfa_reason_code | Reason selected in SFA/E-Work |
| reason_match_status | MATCH / PARTIAL / MISMATCH / UNCLEAR |
| sfa_selection_reason | Why that SFA reason was selected, if known |
| revisit_plan | Planned follow-up |
| can_revisit_earlier | YES / NO / UNKNOWN |
| followup_timing_reason | Reason/signal determining follow-up timing |
| quick_note | Optional operational note |
| client_updated_at | Latest device-side edit time |
| updated_at | Server-side update time |
| last_edited_by | User performing latest server update |
