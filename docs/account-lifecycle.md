# Account lifecycle and session revocation

Implemented in `irq-admin/server` and `irequestd/backend`. The database migration and service rollout have **not** been applied to the shared environment.

## Policy

- An account must exist, have `active = true`, and have no `deletedAt` value. Both services check current database state at login and on every protected request.
- Access tokens identify the account type, token purpose, and `sessionVersion`. Resident, staff, and password-reset tokens cannot substitute for one another. Staff permissions use the current database role.
- Disabling, deleting, or changing/resetting a password revokes all existing account sessions. Access ends on the next protected request. Re-enabling an account requires a fresh login; earlier tokens remain invalid.
- Password changes sign out the current browser/app too. Resets are single use, including simultaneous requests, and invalidate older recovery credentials in both OTP stores.
- Purok approval links include the staff session version and are checked against current account state. Kiosk clearances linked to disabled/deleted residents are refused. Unlinked walk-in clearances retain their existing flow.
- Ordinary logout clears the local session. It does not revoke sessions on other devices; this is separate from password and account lifecycle changes.

The canonical source is `server/lib/accountLifecycle.js`. The independently deployed mobile backend carries an identical vendored copy. Update it from this repository with:

```powershell
node scripts/sync-account-lifecycle.cjs D:\irequestd\backend
node scripts/sync-account-lifecycle.cjs D:\irequestd\backend --check
```

The cross-service test suite checks that the two policy files match. The shared PostgreSQL triggers also invalidate sessions when another database writer changes a password, activity, or deletion state. These triggers belong to the main repository's migration history.

## Rollout

1. Configure `JWT_SECRET` on both services. Use the same strong secret if sessions issued by either service should work on both. The inspected local main-server `.env` had no JWT secret; raw UUID authentication has now been removed, including in development. Secret values were not changed or exposed during this work.
2. During a coordinated service rollout, apply migrations from **this repository's `server` directory** to the intended shared database:

   ```powershell
   node node_modules/prisma/build/index.js migrate deploy
   ```

   The relevant migrations are `20261003000000_resident_account_lifecycle` (existing pending work) and `20261003010000_account_session_revocation` (new). Use the authoritative main migration history; do not separately apply a conflicting mobile history to the same database.
3. Generate the Prisma client in both `server` and `irequestd/backend`, then deploy/restart both backends together:

   ```powershell
   node node_modules/prisma/build/index.js generate
   ```

4. Rebuild/deploy both websites and the resident app. Existing access tokens and earlier approval links intentionally expire at rollout because they lack the new claims. Users must sign in again; leaders can use the portal to handle requests from an older link.
5. Smoke-test an active resident and staff account, then deactivate each while signed in on two clients. Confirm the next protected request is denied on both services. Reactivate and confirm a fresh login works while the old tokens remain rejected. Repeat after password changes and resets.

The new columns and triggers are required before the updated services serve traffic. Keeping an older mobile backend online would preserve its previous authentication bypass.

## Verification completed on 2026-10-03

| Check | Result |
| --- | --- |
| Backend and database regression tests | 42 passed; no failures or skips when both checkouts are included |
| Database migration chain | All 24 migrations applied to an isolated PostgreSQL engine using PGlite |
| Database behavior | Direct updates revoke sessions, recovery credentials clear, reactivation does not restore sessions, reset compare-and-swap succeeds only once |
| Browser checks | 6 passed: admin/resident password change, disabled-account rejection, and revoked-session rejection all clear stored sessions and redirect to login |
| Frontend production builds | Admin and resident builds passed; existing admin bundle-size/Browserslist warnings remain |
| Prisma | Both schemas validated; both clients generated successfully |
| Flutter settings analysis | No errors; 5 pre-existing unused-code warnings and 1 deprecation notice remain |

Run backend and database checks from `server`:

```powershell
$env:MOBILE_BACKEND_DIR = 'D:\irequestd\backend'
npm.cmd test
```

Without `MOBILE_BACKEND_DIR`, only the main backend and database cases run; mobile parity is explicitly skipped. Browser checks and their JSON results are under `qa-reports/2026-10-03/account-lifecycle-browser*`. They use local production bundles and mocked responses. Backend HTTP tests use the real handlers with an in-memory database double; migration tests execute real SQL on isolated PGlite. No live accounts, database records, SMS, email, or payment providers were used. A physical-device sign-out test and deployed-database smoke test remain part of rollout.
