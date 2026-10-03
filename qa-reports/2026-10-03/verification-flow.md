# Resident verification simplification

Removed mother's name, father's name, and the education screen from resident registration in the React portal and Flutter application at `D:/irequestd`.

- Web flow: Personal Information → ID & Face Verification → Under Review.
- App flow: Profile → ID → Face → Under Review.
- Updated progress indicators, back navigation, login/session resumption, and the app's submitted-information list.
- Both backends accept personal information without parent names. Removed education submission and uploads; legacy education endpoints only allow existing clients to continue, without modifying the application or submitting it for review.
- Preserved historical database fields and existing records. No database migration is required.
- Web identity checks accept personal-information stage 1 and legacy education stage 2. Existing callbacks and final submission retain their URLs and persisted stage values.
- The app sends its selected purok with the demographic form; the existing server requires it.

## Validation

- Web server: `npm test` — 158 passed, 3 skipped, 0 failed. Includes direct personal-information → verified ID submission, required personal information, removed-field handling, name matching, and legacy endpoint compatibility.
- Mobile backend: `node --test test/verification-flow.test.cjs` — 5 passed. Covers multipart registration without parents/education, ID and face submission, historical-data preservation, draft/pending transitions, required fields, and authentication.
- Web production build: `npm run build` — passed.
- Real Chrome against the local build with synthetic API responses: `node qa-reports/2026-10-03/didit-browser.cjs` — 19 scenarios passed. Includes mobile-width registration, old education links, back navigation, stage 1/2 login and protected-route resumption, and existing identity/name-mismatch checks. Results: `verification-flow-browser-results.json`.
- Flutter analysis of changed application files: no errors; 6 existing warnings and 18 existing informational diagnostics (unused members, deprecated APIs, and style/context lints). Analysis exits nonzero for these diagnostics.
- Android debug build: `flutter build apk --debug --no-pub` — passed. APK: `D:/irequestd/build/app/outputs/flutter-apk/app-debug.apk`. Existing camera/preferences plugins emitted a Kotlin compatibility warning for future Flutter versions.

The tests do not create real resident applications or send identity documents to external providers. Changes remain local; publishing the web portal, both backends, and an updated app is separate.

Automatic approval review blocked removing the generated `D:/irequestd/android/.kotlin` build cache ("blocked by policy"). The cache was left in place.
