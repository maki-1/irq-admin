# Resident app and web registration comparison

Reviewed on 2026-10-03 against the current local checkouts: `D:\irqadmin\irq-admin` and `D:\irequestd`.

**Result: the overall sequence is similar, but registration is not equivalent. Two payload mismatches block normal onboarding, and validation, OTP, identity checks, and saved progress differ.** This review added QA artifacts only; it did not change application behavior or deploy anything.

## What matches

Both start with username, contact number, optional email, password, and password confirmation. Both then use a six-digit OTP with a ten-minute lifetime, followed by demographics, education, identity/face capture, and staff review. Both demographic screens ask for information certification and privacy/terms consent.

With the two handlers using a shared isolated database, an account registered and OTP-verified through either service could log in through both services. That confirms basic account/password compatibility in the current code, not equivalence of the onboarding steps or deployed configuration.

## Fix these onboarding blockers first

### 1. App Step 1 does not send the selected Purok — high priority

The app requires a Purok selection and includes it in the display address, but omits the separate `purok` field from the map passed to `ApiService.submitStep1`. That service forwards the map unchanged. The mobile backend requires `purok` separately.

**Reproduction:** submit the same fields as the app with an address beginning `Purok 1, ...`. The backend returns **HTTP 400: “Please select your purok”**, and no profile is saved. Selecting a Purok in the current screen does not resolve this omission.

**Work on:** send the selected `purok` field explicitly. Both clients currently hardcode Purok 1–21; populate them from the existing `/verification/puroks` endpoint so the picker agrees with backend configuration.

Sources: [app form](D:/irequestd/lib/verification/demographic_screen.dart:203), [app service](D:/irequestd/lib/services/api_service.dart:229), [mobile validation](D:/irequestd/backend/routes/verification.js:64).

### 2. Web “two secondary IDs” cannot complete — high priority

The web form submits `secondaryIdFront` and `secondaryId2Front`, sets `idType` to `Secondary IDs`, and omits `idFront`. Its backend always requires `idFront`, before examining liveness or the secondary uploads.

**Reproduction:** submit both secondary images, a face image, and a valid synthetic liveness proof. The backend returns **HTTP 400: “Primary ID type and front photo are required.”**

**Work on:** define two explicit, supported ID paths: one eligible primary ID, or two eligible secondary IDs. Validate the chosen path on the server and use the same upload field names in both clients.

Sources: [web payload](D:/irqadmin/irq-admin/client/src/pages/verify/Step3.jsx:146), [web validation](D:/irqadmin/irq-admin/server/src/controllers/resident.verification.controller.js:214).

## Differences residents will encounter

| Area | Resident web portal | Resident app |
| --- | --- | --- |
| Username form | Minimum 3 characters; accepts spaces; no form maximum | 6–20 characters; letters, digits, underscore only |
| Password form | At least 8 characters, uppercase, number, special character | Submit enabled after any 3 of 5 strength checks; even `Ab1` enables it, although the backend rejects that length |
| Contact entry | Accepts local `09...`; does not convert `+63...` | Converts `+63...` to `09...` and displays spaces |
| Optional email | Optional | Optional |
| Demographics | Separate first/middle/last names; civil status; parents optional | Full name in one field; parent names required; no matching civil-status field |
| Years of residence | `yearsAtAddress` | `yearsOfResidency` |
| Education | Education level, school, graduation year required | Entire education section can be submitted empty |
| Category proof | Separate `pwdProof` and `indigentProof`; uploads are not mandatory in the form | Unified `freeDocumentProof`; form requires proof for PWD, under-18, and senior residents |
| Unfinished signup | Empty accounts without verified contact/profile/request history can be reclaimed | Existing username/contact/email is treated as taken, including abandoned registrations |
| OTP verification payload | `{ userId, otp }` | `{ userId, code, type: "register" }` |
| Registration payload | Does not send `confirmPassword` | Backend requires `confirmPassword` |

These are behavior differences, not simply different layouts. Decide the intended rule once and apply it to both interfaces and both APIs.

Sources: [web signup](D:/irqadmin/irq-admin/client/src/pages/public/Signup.jsx:113), [app signup validators](D:/irequestd/lib/signup_screen.dart:100), [app submit gate](D:/irequestd/lib/signup_screen.dart:231), [web education](D:/irqadmin/irq-admin/server/src/controllers/resident.verification.controller.js:172), [app education](D:/irequestd/backend/routes/verification.js:125).

## Backend and verification findings

### 3. Server validation is weaker than the forms — high priority

The following responses were reproduced using the actual handlers and an isolated database double:

| Submitted value | Web backend | Mobile backend |
| --- | --- | --- |
| One-character password `x` | 201, account created | 400 |
| Password `12345678` | 201 | 201 |
| Contact number `123` | 400 | 201 |
| Username `a` | 201 | 201 |
| Email `not-an-email` | 201 | 201 |

The main registration endpoint has no password-strength/length validation. Mobile enforces only an eight-character minimum and matching confirmation. Neither backend enforces the username rules shown by the app or a valid email format. Mobile strips phone punctuation but does not enforce the Philippine-number rule.

**Work on:** one server-side validation policy for username, password, phone normalization, and email, with identical client validation and error messages. The app also treats availability-check failures as “available”; show an unconfirmed/retry state instead of a green availability claim.

Sources: [main register](D:/irqadmin/irq-admin/server/src/controllers/resident.auth.controller.js:174), [mobile register](D:/irequestd/backend/routes/auth.js:210), [app availability responses](D:/irequestd/lib/services/api_service.dart:151).

### 4. OTP delivery and protection are inconsistent — high priority

- When synthetic SMS delivery failed with no email fallback, web returned **502**, while mobile returned **201** and claimed an OTP had been sent.
- With an email address present, web used email after SMS failure. Mobile registration did not try email. The web signup page then discarded the returned `channel`/`sentTo` values: the browser still displayed the phone number on the OTP screen after an email-delivery response.
- Web burns an OTP after five wrong guesses. Mobile still accepted the correct OTP after six wrong attempts; there is no corresponding attempt counter in that handler.
- Web generates codes using `crypto.randomInt` but stores the pending code in `User.otp`. Mobile uses `Math.random`, stores a bcrypt hash in `OtpCode`, and logs the raw code on SMS failure.
- Codes cannot be verified across the backends, even with their respective payload formats. Resending through the mobile backend did not invalidate an outstanding web code; both challenge stores remained independent.
- Both forms have a 60-second resend countdown. The inspected registration/resend routes do not enforce that cooldown server-side. The app's resend screen also shows success without checking the HTTP status returned by `ApiService.resendOtp`.

**Work on:** one challenge store and API contract, cryptographic code generation, hashed code storage, attempt/resend limits, and honest delivery results. Return and display the actual masked destination. Remove raw OTP logging.

Sources: [web delivery](D:/irqadmin/irq-admin/server/src/controllers/resident.auth.controller.js:53), [web attempt limit](D:/irqadmin/irq-admin/server/src/controllers/resident.auth.controller.js:310), [mobile OTP issuance](D:/irequestd/backend/routes/auth.js:13), [mobile verification](D:/irequestd/backend/routes/auth.js:282), [web navigation to OTP](D:/irqadmin/irq-admin/client/src/pages/public/Signup.jsx:87), [app resend](D:/irequestd/lib/otp_screen.dart:132).

### 5. Mobile identity checks can be bypassed at the API — high priority

The app includes a client-side face/blink flow, but the mobile backend accepts ID submission without any face photo or server liveness proof. The same omissions were rejected by the main backend: **400** without a face image and **403** without a liveness proof, versus **200** from mobile.

**Work on:** enforce the chosen identity requirements on both servers, including the secondary-ID path. Client-side camera checks alone do not enforce what the API accepts. Actual camera accuracy and external identity-provider behavior were not tested in this review.

Sources: [main identity gate](D:/irqadmin/irq-admin/server/src/controllers/resident.verification.controller.js:214), [mobile identity gate](D:/irequestd/backend/routes/verification.js:174), [app face submission](D:/irequestd/lib/verification/face_recognition_screen.dart:359).

### 6. Progress and review state are not shared consistently — high priority

- Web tracks completed steps in `User.verificationStep` (0–3). Mobile advances `VerificationProfile.currentStep` (1–3). Saving demographics through mobile left the web's step at 0; saving through web left the mobile profile step at 1. Changing channels can therefore send the resident back to demographics.
- Mobile Step 2 immediately sets profile status to `pending`, even with no ID submitted. The app login/startup routing sends pending accounts to the waiting screen, so restarting after education can skip the remaining ID screen and leave the resident waiting with incomplete documents. The state write was reproduced; the navigation consequence follows the inspected routing code.
- Web creates/updates education via an upsert, so its Step 2 API accepted education without a Step 1 profile. Mobile rejected that sequence.
- After registration OTP, web leaves `isVerified: false` for staff review. Mobile sets `isVerified: true` before any profile exists. The app also reads `accountStatus`, and the web `/me` derives approval from the profile, so this observation alone does not establish unrestricted access. It does establish conflicting meanings for the same database field.
- Web Step 3 writes profile status `Pending`; mobile writes `pending`, while app route comparisons are case-sensitive.

**Work on:** one authoritative profile status and progress model, with a shared next-step response. Keep contact ownership separate from staff approval. Enter review-pending state only after the complete required submission has been validated. Use the same field names for years of residence and supporting documents so staff see equivalent data.

Sources: [web step writes](D:/irqadmin/irq-admin/server/src/controllers/resident.verification.controller.js:149), [mobile step writes](D:/irequestd/backend/routes/verification.js:104), [mobile premature pending](D:/irequestd/backend/routes/verification.js:138), [app login routing](D:/irequestd/lib/login_screen.dart:81), [app startup routing](D:/irequestd/lib/main.dart:64), [mobile OTP flag](D:/irequestd/backend/routes/auth.js:331).

## Recommended order of work

1. Repair the app Purok payload and the web secondary-ID submission.
2. Unify API validation, OTP delivery/limits, and server-enforced identity requirements.
3. Unify verification state, field mappings, and resume behavior; prevent review before the required steps are complete.
4. Align the forms, error text, availability feedback, and OTP destination display with that contract.
5. Add acceptance cases for switching channels after OTP and after every verification step, delivery failure, retrying signup, and both ID options.

The current API contracts are not interchangeable. The inspected web config uses the main backend at `localhost:5000/api` in development and same-origin `/api` in production; the app has its own `API_BASE` build setting. Pointing both clients to a single service requires adapting their registration, OTP, and verification payloads first.

## Evidence and limits

| Check | Outcome |
| --- | --- |
| Real-handler HTTP observations | 21 reproduced, including the two onboarding blockers |
| Browser observations | 6 reproduced using the resident production bundle at a 390px viewport |
| Flutter signup widget checks | 4 passed, confirming the current username/password/phone behavior |

These checks intentionally characterize existing behavior; a successful observation does **not** mean registration passed QA.

Artifacts: [backend observations](./registration-comparison-results.json), [browser observations](./registration-browser-results.json), [browser screenshots](./registration-screenshots), [Flutter checks](./registration-widget_test.dart).

The HTTP harness uses real handlers with shared in-memory database models, synthetic multipart files, and intercepted delivery, upload, and identity services. The browser uses mocked API responses. Flutter uses its test HTTP client, which returns failure responses; this also confirms that availability failures are currently treated as available. No real resident accounts were created and no SMS/email was sent. No deployed database, camera device, or live identity service was exercised.

Run the HTTP/browser observations from the main checkout:

```powershell
node qa-reports/2026-10-03/registration-comparison.cjs
node qa-reports/2026-10-03/registration-browser.cjs
```

The browser harness uses the local bundle and Playwright dependency under `%TEMP%\irequest-qa-20261003`, prepared during the preceding QA work. The widget checks run from `D:\irequestd`:

```powershell
$env:TEMP = 'D:\Temp\irequest-registration-qa-20261003'
$env:TMP = $env:TEMP
& C:\flutter\bin\flutter.bat test --no-pub --reporter expanded D:\irqadmin\irq-admin\qa-reports\2026-10-03\registration-widget_test.dart
```

The first widget compile failed because C: had no free space. Rerunning with the temporary directory on D: completed all four checks. C: was still full at the final environment check and needs separate attention for future builds.
