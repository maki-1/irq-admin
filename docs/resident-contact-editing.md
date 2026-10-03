# Editing resident email and contact number

Implemented locally on 2026-10-03 for **Captain → Residents → Review → Edit contact details**. The request linked the Captain page twice; this implementation grants editing to the Captain only. Secretary and other staff roles cannot call the editing endpoint.

## Behavior

- Shows the resident account's current email and contact number, including residents whose verification profile has blank or stale contact fields.
- Email is optional, trimmed, and saved in lowercase. Leaving it blank removes it from both the account and profile.
- A Philippine mobile number is required. Accepts `09XXXXXXXXX`, `639XXXXXXXXX`, or `+639XXXXXXXXX`, with spaces/hyphens/parentheses, and stores `09XXXXXXXXX`.
- Rejects invalid input and email/phone identifiers already used by another resident, including disabled accounts. Email duplicate checks ignore case.
- Saves the account, verification profile, and staff audit entry in one transaction. A failed write rolls everything back.
- Updates the open profile and list immediately; contact-number search is supported. Cancel discards unsaved edits. A stale edit offers **Reload latest details** before retrying.
- Editing is independent of the three-day approval-review window. Disabled residents can have their contact details corrected without reactivation. Deleted accounts cannot be edited.

## Account policy

These are authenticated staff corrections. Existing password, account activity, approval, contact-verification flag, and registration progress are preserved. The endpoint does not verify ownership of a new contact by OTP, and it does not promote an unverified account to verified.

When the actual account email or number changes, existing sessions are revoked and both backends' pending OTP/reset credentials are invalidated. The resident signs in again with the existing password; an account that has not passed contact verification still follows its normal OTP flow. The edit form explains the sign-in requirement. No SMS or email is sent by this action.

An unchanged save does not revoke sessions or create an audit entry. Synchronizing a stale profile with an unchanged account does not revoke sessions either.

## API and implementation

`PATCH /api/verifications/:profileId/contact`, authenticated as an active **Barangay Captain**:

```json
{
  "email": "resident@example.com",
  "contactNumber": "09999999999",
  "expectedUpdatedAt": "2026-10-03T12:00:00.000Z"
}
```

The email/phone fields support partial updates. The UI sends `expectedUpdatedAt` from the displayed resident account so stale forms cannot silently overwrite a later change. Unknown fields are rejected. A successful response contains the updated profile with safe account contact fields; passwords and recovery credentials are never included.

Status codes: 400 for invalid fields, 401/403 for authentication/permission failures, 404 for a missing profile, 409 for duplicate contacts/stale edits/deleted accounts, and 500 for unexpected write failures.

Key files:

- `admin/src/components/residents/ResidentContactDetails.jsx`
- `admin/src/pages/captain/Residence.jsx`
- `server/lib/residentContact.js`
- `server/src/controllers/residentContact.controller.js`
- `server/src/routes/verification.routes.js`
- `server/src/controllers/verification.controller.js`

## Validation and rollout

- 24 targeted real-route/auth tests passed, covering permissions, normalization, duplicate rejection, safe responses, rollback, session revocation across both backends, and preservation of approval/activity.
- All 93 backend/database regression tests passed with `MOBILE_BACKEND_DIR=D:\irequestd\backend`.
- Five browser scenarios passed using a local production build: desktop/mobile-width editing and persistence, validation/duplicate/failure retry, stale-edit reload, and Secretary read-only behavior.
- Admin production build passed. Existing bundle-size and Browserslist warnings remain. Build output was written under `D:\Temp\irequest-contact-qa-20261003`, preserving existing tracked distribution files.
- JavaScript syntax and diff whitespace checks passed.

Tests use isolated database doubles and synthetic intercepted browser API responses. No live resident details, database records, or delivery providers were changed. Browser results and screenshots are under `qa-reports/2026-10-03/resident-contact-*`.

This feature is **not deployed**. Deploy the main backend and rebuilt admin website together. No new migration is needed for this feature; the previously documented account-lifecycle migration and updated middleware must already be in place for session revocation to work across both services. See `account-lifecycle.md` for those earlier rollout requirements.
