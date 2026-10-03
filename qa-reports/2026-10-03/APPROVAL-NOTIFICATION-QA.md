# SMS and email approval QA — 3 October 2026

**Historical audit.** The findings below describe the initial test run. Follow-up fixes and current verification are recorded in [the email approval fix report](../../docs/approval-email-fix.md). The linked JSON artifacts are updated when tests are rerun and now reflect the current implementation.

**Result: not ready for an end-to-end pass in the tested setup.** The normal notification and approval paths work with isolated fixtures, but the local credentials/database configuration and several application defects prevent a clean result. Actual SMS receipt and inbox delivery have not been confirmed.

This audit covers the current web/admin/kiosk checkout in `D:\irqadmin\irq-admin` and the mobile backend in `D:\irequestd\backend`. It adds QA scripts and reports only. No application source was changed, migrations applied, real requests approved/rejected, or messages sent to people.

| Checks | Passed | Failed | Evidence |
| --- | ---: | ---: | --- |
| New notification, sender, HTTP approval, contact-edit and trigger contracts | 41 | 16 | [57 results](approval-notification-results.json) |
| Chrome approval page, desktop and mobile viewport | 5 | 1 | [6 results](approval-browser-results.json) |
| Existing backend and database regression tests | 93 | 0 | [Test output](approval-regression-results.txt) |
| Read-only provider authentication and database compatibility | Mixed | See below | [Provider results](approval-provider-results.json) |
| Public deployment without credentials | 2 expected responses | 0 | [Public smoke results](approval-public-smoke.json) |

Failed contract checks describe desired behavior that the current implementation does not satisfy. Multiple checks can reproduce the same issue on different backends; these counts are not counts of unique defects. The existing regression suite passing does not override the new failures.

## What is working

- Web and mobile notification helpers use the leader's contact number for SMS and **Notify Email** for email. The login email is not used as a fallback.
- Philippine mobile numbers are normalized to `+63…`. The SMS body tells the leader to sign in; it contains no approval link and there is no reply-by-SMS approval flow in the tested code.
- Web bulk submission, web payment-request submission, mobile single submission and mobile bulk submission each dispatch one SMS and one email per submission with provider doubles.
- Captain contact edits feed the next notification in the HTTP fixture. A non-Captain cannot edit the account.
- With a signing secret and a compatible synthetic database, web emails include a valid versioned approval link. Normal approve/reject actions update the request, calculate the approval fee, and write an audit record.
- Expired, tampered, revoked-version, disabled-account and wrong-role links are rejected in the current web controller. Requests explicitly assigned to another purok are blocked.
- The approval page works at 1280px and 390px widths, shows decisions, handles an empty queue, and allows retry after an action failure. [Mobile screenshot](approval-screenshots/approve-and-reject-390.png).

## Configuration and deployment blockers

**1. Current source and the connected database are out of sync.** Both generated Prisma clients failed the actual read-only Purok Leader lookup with `P2022`. A SQL schema check confirmed that `admins.sessionVersion` is absent. The earlier account-lifecycle work added this field and has a pending migration, so current source cannot be treated as deployable against this database yet. This is a compatibility prerequisite for the current local changes, not proof that the already-deployed build has this exact failure.

Action: verify the intended database and deployment revision, then apply the reviewed lifecycle migrations in the correct order and regenerate both clients as part of the release. The relevant migration is [account session revocation](../../server/prisma/migrations/20261003010000_account_session_revocation/migration.sql); prerequisite lifecycle changes are also pending. This audit did not migrate a live database.

**2. Web email authentication fails.** Using `server/.env` and the same Gmail transport settings, SMTP verification returned `EAUTH`, SMTP `535`, twice. An intervening attempt timed out. The mobile backend's own SMTP credentials authenticated successfully. No email was submitted by these checks.

Action: correct the web service's Gmail SMTP credentials/app password and verify authentication again. Check deployed environment variables separately; local results do not establish the production host's settings.

**3. The local web approval URL is `http://localhost:5173`.** An email created with this configuration sends a recipient back to their own device. Set the production service's `PORTAL_URL` to the externally reachable admin origin, normally `https://www.irq-dologon.com`, and verify the complete generated link against the deployed API. The public `/purok-approve` page currently returned HTTP 200 and the API rejected an unsigned request with HTTP 401, as expected. No valid production approval link was generated or used.

**4. Purok 10 has three active leaders in the connected database.** An active row with phone ending **9915** and a Gmail Notify Email exists, matching the visible contact pattern in the screenshot. Two other active Purok 10 rows have no Notify Email. Both notification helpers use `findFirst` with no explicit recipient-selection rule. A fixture placing an email-less account first sent zero emails, even though another matching leader had a reachable inbox.

Action: designate one current leader per purok and enforce that rule, or define explicit multi-leader routing. Editing one account does not guarantee that it is the account selected for notifications. References: [web lookup](../../server/lib/purokNotify.js), [mobile lookup](D:/irequestd/backend/lib/purokNotify.js).

**SMS provider check:** both local API credentials were accepted by the read-only account endpoint. It reported an active account and **91 SMS credits** at test time. This does not validate the configured sender through an actual send, carrier delivery, or handset receipt. The provider documents separate submission and message-status checks in its [official SMS API documentation](https://unismsapi.com/docs/sms). Zero available SID tokens alone is not evidence of a sending failure.

## Application defects reproduced

| Priority | Finding and evidence | Suggested work |
| --- | --- | --- |
| High | A Purok 1 signed link listed and approved a legacy profile whose `purok` was null and whose address was `Purok 10, Dologon`. Two HTTP fixture checks failed. | Replace the address substring fallback with an exact, normalized purok identifier; migrate legacy profiles. Add read and write authorization regression checks. [Controller](../../server/src/controllers/purokApprove.controller.js) |
| High | Mobile notification lookup selected an inactive leader and attempted all three channels. | Apply the same active-account routing policy as the web backend. [Mobile notifier](D:/irequestd/backend/lib/purokNotify.js) |
| Medium | Mobile-generated emails contained no approval button or signed link; web-generated emails did. | Share the notification template and link policy, and configure a common portal and signing policy deliberately. |
| Medium | Three active leaders in one purok let `findFirst` silently select an account with no Notify Email. Reproduced in both helpers and corroborated by the read-only database check above. | Resolve the assignment and define deterministic recipient selection before live delivery testing. |
| Medium | Simultaneous approve and reject requests both returned 200 in a controlled concurrent HTTP fixture. The update checks only request ID after an earlier pending-state read. | Make the pending-state transition conditional and atomic; return 409 to the losing action. |
| Medium | Injecting an audit failure returned HTTP 500 after the request had already changed to approved. | Commit the decision and audit together, or explicitly report the committed decision while reliably queueing the audit. |
| Medium | Both helpers returned `notified:true` when in-app creation, SMS and email all failed. The external sends run asynchronously and only log errors. | Treat scheduling, provider acceptance and delivery as distinct states. Persist attempts, bounded retries, failure reasons and provider message IDs; expose channel status to staff. A successful submission is not delivery confirmation. |
| Medium | Captain account update accepted `123` as a contact number and `not-an-email` as Notify Email with HTTP 200. | Validate and normalize notification contacts on the server, including edits. [Controller](../../server/src/controllers/user.controller.js) |
| Medium | Both email templates inserted resident-supplied HTML into the email body without escaping; the test inserted an additional external link. | Escape all interpolated names, purok and document text. This proves HTML injection in the generated message, not JavaScript execution in a mail client. |
| Medium | Mobile SMS calls had no explicit HTTP timeout and still contacted the provider double when the sender ID was absent. | Use bounded timeouts and fail configuration validation before dispatch. [SMS service](D:/irequestd/backend/services/sms.js) |
| Low | A kiosk fixture redeemed a clearance and returned an already-approved request, then sent an “approval needed” alert. | Skip the approval-needed alert for redeemed clearances, or use an informational message with accurate status. The clearance helper was modeled as successfully redeemed in this fixture. [Kiosk controller](../../server/src/controllers/kiosk.controller.js) |
| Low | Opening an expired public approval link while signed in cleared the existing staff session and redirected to `/login`. | Exempt public signed-link failures from the global session-logout interceptor. [API client](../../admin/src/services/api.js), [browser result](approval-browser-results.json) |

## Suggested order

1. Resolve schema compatibility for the intended release, web SMTP authentication, production portal URL and the duplicate Purok 10 assignment.
2. Fix the cross-purok authorization fallback and align inactive-leader routing across backends.
3. Make decisions atomic with audit handling; align mobile email links, validate contact edits and record per-channel delivery attempts.
4. Re-run the failed contracts. Then send one clearly labeled test SMS and email to an explicitly authorized recipient, check the provider status and actual receipt, and exercise approval using a dedicated synthetic request.

The user was asked whether to authorize live test messages. No affirmative answer was received during this audit, so there were **zero live SMS or email sends**. SMTP authentication, provider account reads and database reads were performed. Production delivery, hosting-specific SMTP reachability, carrier receipt and inbox placement remain unverified.

## Reproduction

Run from `D:\irqadmin\irq-admin`:

```powershell
node qa-reports/2026-10-03/approval-notifications.cjs
node qa-reports/2026-10-03/approval-browser.cjs
```

The first command uses the current checkout and the mobile checkout with all external senders/database operations replaced by doubles. It exits 1 while the documented contracts fail. The browser command uses the existing production admin build at `D:\Temp\irequest-contact-qa-20261003\admin-build` and installed Playwright; override `ADMIN_QA_BUILD` to test a fresh build. All external browser traffic is blocked. Screenshots contain synthetic records only.

The optional read-only provider check uses real credentials from both local `.env` files but never sends a message:

```powershell
node qa-reports/2026-10-03/approval-provider-check.cjs
$env:MOBILE_BACKEND_DIR='D:\irequestd\backend'
Push-Location server
node --test test/*.test.cjs
Pop-Location
```

Artifacts retain only sanitized provider/database findings, synthetic test data and masked phone suffixes. Configuration was not changed by these tests.
