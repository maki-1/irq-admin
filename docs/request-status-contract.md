# Request status and pickup contract

Implemented locally on 2026-10-03 in the admin website, resident website, and `D:\irequestd` backend/resident app. The services have not been deployed. Kiosk-origin requests use the same request and release workflow.

## Status meanings

| API status | Meaning |
| --- | --- |
| `Pending` | Received and awaiting the required approval/payment or staff action. |
| `Processing` | Accepted for preparation. |
| `Printing` | Being printed/finalized; no eligible release record exists yet. |
| `Ready for Pickup` | A completed-document record exists and is still unclaimed. |
| `Claimed` | Handover has been recorded. |
| `Rejected` | Staff or the Purok Leader rejected the request. |

Approval and payment remain separate fields. In particular, `CompletedDocument.claimStatus = "pending"` means **Ready for Pickup**, not a Pending request.

The canonical implementation is `server/lib/requestStatus.js` and `server/lib/requestWorkflow.js`. The independently deployed mobile backend carries identical copies. Synchronize/check them from this checkout:

```powershell
node scripts/sync-request-status.cjs D:\irequestd\backend
node scripts/sync-request-status.cjs D:\irequestd\backend --check
```

## Resident API

Both `GET /api/my/requests/summary` (main backend) and `GET /api/requests/summary` (mobile backend) return the same flat object. An empty response is:

```json
{
  "total": 0,
  "pending": 0,
  "processing": 0,
  "printing": 0,
  "ready": 0,
  "claimed": 0,
  "rejected": 0,
  "readyDocuments": []
}
```

- All counts are nonnegative integers. Clients read these exact lowercase keys; `Completed` and `Ready` are not summary keys.
- `ready` is always `readyDocuments.length`. Both come from the same repeatable-read database snapshot. The web and app dashboards consume that list, including documents older than the five most recent requests.
- `total` counts the resident's requests. `pending`, `processing`, `printing`, and `rejected` count their normalized request states. `ready` and `claimed` count eligible release records, deduplicated by request. Imported, standalone release records can make the bucket sum differ from `total`; clients must not infer pickup count by subtracting other buckets.
- A release response has canonical `status`, lowercase `claimStatus` (`pending` or `claimed`), claim code, preparation/claim dates, and the existing document fields. Nested request status is normalized too. The serializers retain the existing `_id` compatibility alias.
- Release ownership must match the signed-in resident. Legacy rows with a null owner can be resolved through their linked request; conflicting ownership is excluded.

Main backend release lists: `/api/my/requests/completed?status=pending`, `/api/my/requests/completed?status=claimed`, and `/api/my/requests/claimed`. The last two return the same claimed-document shape. Mobile lists: `/api/requests/completed` and `/api/requests/claimed`.

## Existing data and writes

- Legacy request values `Completed`/`Ready` become Ready for Pickup only when an eligible release exists. Without one, they display as Printing; staff can use **Mark ready** to finalize the release.
- On an actual release record, a null/empty claim status or an exact `pending`, `ready`, `ready for pickup`, or `unclaimed` value means unclaimed. Matching ignores case and surrounding whitespace.
- A claim timestamp, exact `claimed`/`complete`/`completed` claim value, or linked Claimed request is handover evidence and prevents a pickup count. Handover evidence takes precedence over a stale pending duplicate.
- Duplicate release rows linked to one request count once. Rejected records and unknown claim values are excluded from pickup. Unknown values need staff review; they are not silently advertised as ready.
- Allowed preparation transitions are Pending to Processing/Printing, Processing to Printing, and Printing to Ready for Pickup. These stages can instead be rejected before readiness. Preparation requires a paid/free request. Ready and Claimed records cannot be sent back to printing through a generic status update.
- Marking ready writes the request status, claim code, and completed-document row in one transaction. New releases explicitly set `claimStatus = "pending"` and `completedAt`. Conditional request updates prevent competing completion writes from both succeeding; a stale action receives HTTP 409 and should be refreshed/retried.
- Claiming or undoing a claim updates release rows, `claimedAt`, and request status together. Repeating the same claim preserves its timestamp. A request becomes Claimed through the handover action, not the generic status endpoint.
- Legacy `Completed`/`Ready` status-update inputs remain accepted as aliases for Ready for Pickup, subject to the same transition rules. Responses use canonical names.

The web dashboard refreshes every 30 seconds and on return to a visible tab. Fetch failures show an error/retry action rather than a misleading zero count. Mobile uses its existing refresh flow with the same summary contract.

## Verification and rollout

| Check | Result |
| --- | --- |
| New status/workflow tests | 27 passed across both backends |
| Full backend/database regression suite | 69 passed, zero failures/skips |
| Browser scenarios | 6 passed: desktop/mobile-width resident dashboard, failure/retry, secretary/captain status filters/actions, release handover |
| Key reproduction | Two completed unclaimed documents produce `ready: 2`; claiming them reduces the count to 1 then 0 |
| Website production builds | Both passed; existing admin bundle-size/Browserslist warnings remain |
| Flutter analysis of the three edited screens | No errors; 8 existing unused-code warnings and 2 existing informational findings remain |
| JavaScript syntax, diff whitespace, vendored parity | Passed |

Run from `server`:

```powershell
$env:MOBILE_BACKEND_DIR = 'D:\irequestd\backend'
npm.cmd test
```

Status tests use real HTTP handlers with transactional database doubles, including simulated write failures. They do not prove lock behavior under live PostgreSQL contention. The existing migration tests execute SQL on isolated PGlite. Browser checks use local production bundles and intercepted synthetic API responses; results are in `qa-reports/2026-10-03/pickup-browser-results.json`. No live records, payment providers, email, or SMS were changed or called.

Deploy both backends and rebuild/deploy both websites and the resident app together. This status fix needs no new database migration; the separate account-lifecycle migrations and rollout requirements in `account-lifecycle.md` still apply. After rollout, smoke-test one web, mobile, and kiosk request through Printing, Ready for Pickup, and Claimed, including a resident-app refresh. Physical-device behavior and deployed database concurrency remain rollout checks.

The older, separate staff `/api/documents` register has no resident/request linkage and does not supply these pickup counts. Its historical rows are not treated as resident releases.
