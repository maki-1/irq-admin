# Resident registration and request improvements

Implemented locally on 2026-10-03. No deployment or live data changes were performed.

- Resident birthday picker disables dates after today in Asia/Manila. The server rejects future or invalid calendar dates and calculates age and senior status from the birthday.
- Admin account creation and editing accept a supplied contact number only when it contains exactly 11 digits starting with 09. Typing and pasting are limited to digits and 11 characters; the server also validates the value. Email-only notification contacts remain available for Purok Leaders.
- Purok Leader Requests now has an Archive tab containing rejected requests. Restore returns the same request to Pending for another review, clears the previous decision, retains payment information, and records the previous rejection reason in the audit trail. Only an active leader assigned to that resident's purok can restore it. Completed documents block restoration. No database migration is required.
- Verified residents receive a popup with the Purok Leader's rejection reason on entering their portal or within the next 15-second poll while the page is visible. Returning to the browser tab also checks for changes. View requests opens the Rejected tab. Acknowledgments are stored per resident and decision in that browser; another browser can show the notice again. A later rejection after restoration produces a new notice.

Validation:

- Backend suite: 134 passed, 0 failed, 3 existing skips for optional sibling mobile-backend checks.
- Client and admin production builds passed. Admin build output went to a temporary directory to preserve tracked admin/dist files. Existing bundle-size and Browserslist warnings remain.
- Seven local Chrome browser scenarios passed using synthetic API responses: birthday cutoff across timezones; admin create/edit phone validation; desktop and mobile archive restore, conflict handling, and re-rejection; popup reason, keyboard focus and navigation; persistent acknowledgment; polling, restoration and a second rejection; multiple queued notices and missing-reason fallback.
- Screenshots and machine-readable browser results are in this report directory. All test accounts and requests are synthetic.

Re-run the backend suite with `npm test` from `server`. The browser script expects a current `client/dist` build and the admin build at `%TEMP%/irequest-admin-improvements-build` (override with `IMPROVEMENTS_ADMIN_BUILD`). It uses the local QA Playwright installation listed at the top of the script.
