# Didit resident verification

Step 3 uses a published Didit **Free KYC** workflow containing ID Verification,
Passive Liveness, and Face Match. Didit captures the document and selfie together.
The resident returns to the same browser and selects **Submit for Review**.
The backend retrieves the authenticated decision, requires all three checks to
be Approved, copies the verified images to Cloudinary, and saves the application
as Pending for the existing barangay staff review. It never automatically grants
resident approval. Captain and Secretary review screens show the Didit checks.

## Server configuration

Set these in `server/.env` locally and in the **Environment** settings of the
Render service that serves `/api/verification`:

```dotenv
DIDIT_API_KEY=your_private_application_key
DIDIT_WORKFLOW_ID=your_published_workflow_id
```

Keep the existing `JWT_SECRET`, Cloudinary credentials, database connection, and
`CLIENT_URL` settings. `CLIENT_URL` is a comma-separated list of exact allowed
portal origins, including `https://irq-client.vercel.app` and the local origin
when testing locally. Do not replace other allowed origins. The optional
`LIVENESS_SESSION_SECRET` falls back to `JWT_SECRET`.

Run `npm run check:didit` from `server` for a read-only check of the key and
workflow. Credentials stay on the server and are never Vite environment variables.
Publish both the backend and resident client changes; deploy the admin build to
show the new staff summary. Local `.env` files are ignored by Git and are not
uploaded to Render. This change does not require a database migration.

## Session behavior

- Server endpoints: `POST /api/verification/identity/session`,
  `POST /api/verification/identity/complete`, and `POST /api/verification/step3`.
- The callback is built from the allowed request origin and returns to
  `/verify/step3?verification=return`. Callback query parameters are never
  evidence of approval. No webhook configuration is needed for this integration.
- Signed session tokens bind the resident, account session version, application
  profile, Didit session, and configured workflow. A reset application invalidates
  the old binding. Resume tokens last one hour; submit proofs last 15 minutes.
- The resume token stays in that browser tab's session storage, scoped to the
  resident. Refreshing Step 3 checks the result again. If Didit is processing or
  reviewing the check, use **Check result** later in the same browser. An expired
  resume token requires a new check.
- Sandbox approvals cannot verify residents. Use isolated test fixtures for
  automated tests; perform the real camera acceptance test with a consenting
  tester using the Live application.
- The hosted workflow chooses its supported countries and photo ID types.
  The previous two-supporting-document upload path is replaced by this hosted
  workflow. Residents whose documents are unsupported need help from barangay
  staff; they cannot bypass the required identity checks online.
- Only authenticated Didit image URLs on Didit, Amazon S3, or CloudFront hosts
  are imported. Private signed URLs and full provider reports are not stored in
  application logs. Cloudinary stores the copies used by existing staff review.

## Verification

From `server`, run `npm test`; from `client`, run `npm run build`.
The repository tracks `admin/dist`, so build admin QA assets outside the checkout:

```powershell
# From admin:
node node_modules/vite/bin/vite.js build --outDir D:/Temp/irq-didit-admin-qa
# From the repository root (uses the existing Playwright QA installation):
$env:DIDIT_ADMIN_BUILD = 'D:/Temp/irq-didit-admin-qa'
node qa-reports/2026-10-03/didit-browser.cjs
```

The new backend tests use synthetic identities, provider responses, and storage.
They cover approval requirements, pending/declined/expired decisions, forged or
cross-resident tokens, application resets, sandbox results, rechecking decisions,
media failures, submission retries, and transactional rollback.

For a live acceptance test, use a resident who has completed steps 1 and 2.
Start the Didit check, complete the supported photo ID and live selfie steps,
return to the portal, and submit. Confirm the ID front/back and verified selfie
appear in staff review and the resident stays Pending until staff approve them.
An API connection check alone does not validate camera capture or document coverage.

On 2026-10-03, the configured live key retrieved the published Free KYC workflow
with Passive Liveness and Face Match enabled. One synthetic, unfinished session
was created to verify session creation and authenticated decision retrieval;
no ID, selfie, or resident data was sent. It appears as an unfinished connection
check in Didit, not a completed resident verification. The backend suite passed
113 tests with 3 pre-existing skips, both frontend builds passed, and all 8
synthetic browser scenarios passed. The real ID/selfie acceptance test and
deployment are still required.

References: [create session](https://docs.didit.me/sessions-api/create-session),
[retrieve decision](https://docs.didit.me/sessions-api/retrieve-session), and
[workflow setup](https://help.didit.me/workflows/build-a-verification-workflow).
