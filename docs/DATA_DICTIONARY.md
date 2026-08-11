# DATA DICTIONARY — v0.2.0

## Visit
| Field | Type | Meaning |
|---|---|---|
| id | string | Unique Visit ID |
| deviceId | string | Device/browser identity that created the visit |
| date | YYYY-MM-DD | Business visit date |
| depot | string | Area/depot |
| salesman | string | Salesman name |
| salesmanId | string | Optional salesman ID |
| observer | string | Field observer |
| routeTeam | string | Optional team/route context |
| notes | string | Optional visit note |
| status | active/completed | Visit state |
| startedAt | ISO timestamp | Captured when Start Field Visit is pressed |
| endedAt | ISO timestamp/null | Captured when End Field Visit is confirmed |
| updatedAt | ISO timestamp | Last visit-state update |
| calls | array | Saved call records |

## Call
| Field | Type | Meaning |
|---|---|---|
| id | string | Unique Call ID |
| seq | integer | Call sequence within visit |
| outletName | string | Outlet name |
| outletId | string | Optional outlet ID |
| routeStatus | JKS/OFF | Route status |
| result | EC/NON_EC | Visit result |
| orderValue | number | Optional EC omzet/order value in IDR |
| callAt | ISO timestamp | First time result was selected; preserved on edit |
| observedPrimaryId | string | Canonical actual reason category |
| customObservedReason | string | Mandatory raw actual reason when primary = Other |
| contributingFactorId | string/null | Optional supporting factor category |
| customContributingFactor | string | Raw supporting label if factor = Other |
| evidence | string | Observed factual evidence |
| sfaReasonId | string | Reason selected by salesman in SFA |
| reasonStatusAuto | enum | Auto Match/Partial/Mismatch/Unclear |
| reasonStatusFinal | enum | Current stored classification |
| sfaSelectionWhyCode | string | Why SFA reason was selected when known |
| followupPlan | code | D1/D2/D3/WEEK/NEXT_JKS/WA_PHONE/NONE/UNKNOWN |
| canRevisitEarlier | YES/NO/UNKNOWN/null | Earlier revisit feasibility |
| followupTimingReason | string | Why follow-up timing was selected |
| quickNote | string | Optional operational note |
| createdAt | ISO timestamp | Call draft creation |
| updatedAt | ISO timestamp | Last save/update |
| lastEditedAt | ISO timestamp/null | Set when a saved call is edited |

## Draft
Stored per Visit ID:
- draft call object
- callStage
- editingCallId
- editingVisitId
- editingReturn
- savedAt

## Portable JSON
### Visit Package
`type = FVI_VISIT_PACKAGE`
Contains one Visit and a reason-taxonomy snapshot.

### Full Backup
`type = FVI_FULL_BACKUP`
Contains the complete local application state.
