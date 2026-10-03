# Registration ID name matching

Implemented locally on 2026-10-03. Deploy the server and resident client together
to apply the check to the live registration flow. No database migration is needed.
Existing submitted applications and resident accounts were not modified.

The Under Review page no longer gives a business-day estimate. It displays the
registered full name returned by the verification-status endpoint, rather than
the account's login username.

The server now compares the authenticated ID report's name with the stored Step 1
full name before issuing submission proof and again before submitting for staff
review. Case, whitespace and canonically equivalent Unicode characters may differ.
Name order, middle names, suffixes, spelling and accents must match. There is no
fuzzy match or initials substitution. Missing names fail closed, as do mismatched
names on any additional ID in the same report.

The final database update includes the checked full name in its condition so an
edit during media import cannot submit a mismatched application. Earlier-step
writes now save profile and resident state in one transaction. They cannot rename
an already submitted or approved applicant, including a Step 1 request that began
before Step 3 committed.

Residents see a clear mismatch message with an Edit full name in Step 1 button.
Submit for Review stays disabled after a mismatch or unreadable ID name. Draft
corrections can reuse an unexpired verification session after completing the
earlier steps again; unreadable ID names require a fresh scan. Provider branding
has not been added to these messages.

Validation:

- Backend suite: 155 passed, 0 failed, 3 existing optional mobile-backend skips.
- 21 added backend cases cover differing names, formatting, initials, omitted or
  changed middle names, missing data, multiple IDs, browser-supplied spoofed
  names, rechecking on submission, concurrent edits, draft correction,
  post-submission edit prevention, and transaction rollback.
- Resident production build passed.
- 13 Chrome browser scenarios passed using local builds and synthetic responses.
  They include mobile mismatch handling, disabled submission, Step 1 navigation,
  missing-name recovery, failures after earlier success, the revised Under Review
  screen, and the existing hosted-verification and staff-review checks.
- Screenshots were visually inspected. External image requests are blocked by the
  browser test harness, so hosted logos appear as placeholders in QA screenshots.
- No live ID scans, resident records, paid sessions, provider configuration changes
  or deployments were performed for this change.

See `didit-name-match-browser-results.json` and `didit-name-match-screenshots`.
Run the backend suite with `npm test` from `server`; build the resident client with
`npm run build` from `client`. The browser runner is `didit-browser.cjs`; it accepts
`DIDIT_ADMIN_BUILD` for a local admin build and uses the existing QA Playwright
installation declared at the top of that script.
