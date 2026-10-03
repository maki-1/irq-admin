# Approval email fixes — 3 October 2026

The code and local configuration are fixed and tested. Gmail SMTP authentication now succeeds for both backends. The connected database still needs the existing lifecycle migrations before the updated services can process real approval notifications. Nothing has been deployed, and no live email or SMS was sent.

## Resulting behavior

- Web and mobile share the same Gmail transport, notification template, signed-link implementation and contact validation. Mobile emails now include **Review & Approve**.
- As requested, notices go to **all active Purok Leaders assigned to the resident's purok**. A matching account without Notify Email no longer prevents other assigned leaders receiving email. Each email carries that leader's own signed link. Disabled leaders are excluded. No staff accounts were deactivated or reassigned.
- Email uses **Notify Email**, not the login identifier. Phone and email edits are validated on create and update. Email HTML escapes profile values, and the message includes a text alternative.
- Production links require an explicit HTTPS admin origin and reject localhost. Both local configurations now use `https://www.irq-dologon.com` and the same signing secret. Missing signing configuration falls back to normal sign-in, with a configuration warning.
- Each channel returns saved, accepted, failed or skipped status. SMTP acceptance and its message ID are preserved. In-app, SMS and email failures are isolated; all-channel failure is no longer reported as notified. Network calls have bounded timeouts.
- Email and portal approval decisions check the pending state at update time. Decisions and audits commit together. A second concurrent action cannot overwrite the first. Legacy address matching no longer treats Purok 10 as Purok 1.
- An expired public approval link no longer logs out an otherwise signed-in user. Kiosk submissions backed by an already-redeemed clearance do not send another approval-needed alert.

Delivery status is currently returned to the calling backend and failures are logged. It is not a durable delivery outbox or a dashboard delivery-history feature; automatic retries and confirmed inbox/carrier receipt are not claimed.

## Local configuration repaired

The web backend's rejected Gmail account was replaced locally with the already-working sender configuration from the residence-app backend. This changes the web email's sender identity to the app's sender, with the display name `iRequestDologon`. Secret values were not printed or committed. The original `.env` files are backed up privately under `D:\Temp\irequest-email-fix-20261003\private`.

The missing local web `JWT_SECRET` was aligned with the existing mobile value, and the mobile `APPROVE_LINK_SECRET` was aligned with the existing web value. These settings are required by the previously implemented shared account/session policy. Local process restarts are needed to load changed environment files. Existing user-run servers were not stopped or restarted.

The Render blueprint now declares `PORTAL_URL`, `APPROVE_LINK_SECRET`, `EMAIL_USER` and `EMAIL_PASS`. Declaring them does not update a deployed service or upload local secrets.

## Verification

| Check | Result |
| --- | --- |
| Real Gmail SMTP authentication using each backend's actual email module | Passed for web and mobile; no message submitted |
| Backend/unit/database regression suite | 106 passed, zero failures or skips |
| Notification and approval HTTP contract checks | 61 passed, including cross-channel concurrent decisions and audit rollback |
| Chrome approval page, desktop and mobile sizes | 6 passed |
| Admin production build | Passed; existing bundle-size warning remains |
| Shared web/mobile notification module parity | Passed |
| Connected database readiness | Blocked: missing `admins.sessionVersion`, Prisma `P2022` |

Evidence: [SMTP results](../qa-reports/2026-10-03/email-fix-provider-results.json), [regression output](../qa-reports/2026-10-03/email-fix-regression-results.txt), [notification results](../qa-reports/2026-10-03/approval-notification-results.json), [browser results](../qa-reports/2026-10-03/approval-browser-results.json), [readiness check](../qa-reports/2026-10-03/email-fix-readiness.json).

Backend HTTP fixtures use real handlers with isolated Prisma/provider doubles. The existing migration suite executes the full migration chain in isolated PGlite. Browser tests intercept APIs and block external traffic. SMTP verification authenticates only; it does not establish inbox delivery or outbound connectivity from the deployed host.

## Release steps still required

1. Configure both deployed backends with the intended Gmail sender/app password, the same `APPROVE_LINK_SECRET`, and `PORTAL_URL=https://www.irq-dologon.com`. Match the deployed `JWT_SECRET` to the coordinated session-policy release; do not casually rotate a live signing key.
2. Apply the reviewed main-repository lifecycle migrations to the intended shared database during the coordinated rollout. They add resident lifecycle fields plus resident/staff session versions and revocation triggers. Run the authoritative migration history once from `server`, not separately from the mobile repository:

   ```powershell
   node node_modules/prisma/build/index.js migrate deploy
   node node_modules/prisma/build/index.js generate
   ```

   Required pending migrations: `20261003000000_resident_account_lifecycle` and `20261003010000_account_session_revocation`. The source and clients currently depend on them. See [account-lifecycle rollout](account-lifecycle.md) for the cross-service session impact. Existing sessions and old approval links must be replaced by fresh sign-ins/links when the new authentication code is released.

3. Regenerate the mobile Prisma client, deploy/restart both backends together, and publish the rebuilt admin website. A prepared admin bundle is at `D:\Temp\irequest-email-fix-20261003\admin-build`. The broader pending resident-site/app changes in this workspace have their own coordinated rollout requirements.
4. Run `npm run check:approval-email` from `server` on the intended environment. It authenticates SMTP, validates the public portal/signing configuration and reads the required staff schema without sending a message or writing database rows. It currently exits 1 locally because the shared database migration is pending.
5. With an explicitly authorized test recipient, send one labeled test message, confirm receipt, and approve a dedicated synthetic request. No such live send was authorized or performed in this fix.

If the backend uses a **free Render web service**, Gmail SMTP cannot work there because outbound ports 25, 465 and 587 are blocked. Use an email provider's HTTPS API or a suitable paid service plan in that case. No hosting purchase or new provider integration was made. See [Render's official limitation](https://render.com/docs/free). Gmail authentication requires an appropriate app password; see [Nodemailer's Gmail guide](https://nodemailer.com/guides/using-gmail).

## Maintain and rerun

From the main repository:

```powershell
node scripts/sync-approval-notifications.cjs D:\irequestd\backend --check
node qa-reports/2026-10-03/approval-notifications.cjs
$env:MOBILE_BACKEND_DIR='D:\irequestd\backend'
Push-Location server
node --test test/*.test.cjs
Pop-Location
$env:ADMIN_QA_BUILD='D:/Temp/irequest-email-fix-20261003/admin-build'
node qa-reports/2026-10-03/approval-browser.cjs
```

When changing shared email behavior, update the main `server/lib` modules and run the sync command without `--check` before deploying the mobile backend.
