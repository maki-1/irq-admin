# Reproducing this QA review

All identities, OTP values, session IDs, records and JWT secrets in the reproduction scripts are synthetic. The backend script replaces database, messaging and payment dependencies before loading the real handlers. It does not load either backend's `.env`, connect to PostgreSQL, send messages, or contact PayMongo.

Run from `D:\irqadmin\irq-admin`:

```powershell
node qa-reports/2026-10-03/reproduce-backend.cjs
```

The browser scripts require the QA tools installed under `$env:TEMP\irequest-qa-20261003\node_modules` and Google Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`. They intercept API calls and use synthetic responses. Public Cloudinary/font assets may be fetched. Builds were created outside tracked `dist` directories.

```powershell
$qaToolDir = Join-Path $env:TEMP 'irequest-qa-20261003'
npm.cmd install --prefix $qaToolDir --no-audit --no-fund playwright @axe-core/playwright
```

From the `admin` directory, build with:

```powershell
node node_modules/vite/bin/vite.js build --outDir "$env:TEMP\irequest-qa-20261003\admin-build"
```

From the `client` directory:

```powershell
node node_modules/vite/bin/vite.js build --outDir "$env:TEMP\irequest-qa-20261003\resident-build"
```

From `D:\irequestd`:

```powershell
flutter analyze --no-pub
flutter build web --no-pub --target lib/main_kiosk.dart --output "$env:TEMP\irequest-qa-20261003\kiosk-build" --dart-define=KIOSK_API_BASE=http://127.0.0.1:6199/api
```

From the web repository root, run browser scripts sequentially. The two kiosk scripts use local port 6199 and must not run at the same time:

```powershell
node qa-reports/2026-10-03/reproduce-browser.cjs
node qa-reports/2026-10-03/reproduce-kiosk.cjs
node qa-reports/2026-10-03/reproduce-kiosk-pointer.cjs
```

The kiosk scripts include a real 63-second wait. The first uses Flutter's web accessibility tree; the second uses ordinary mouse input before enabling semantics to inspect the result. Their differing idle behavior is explicitly distinguished in the report. Native touchscreen and assistive-technology behavior still needs a physical-device test.

The results are observations of the current code, not assertions that the system is correct. In particular, HTTP 200/201 in a defect reproduction can mean the authorization or payment check failed. Controlled database doubles demonstrate handler behavior and failure windows; concurrency and rollback must also be tested against disposable PostgreSQL.

`npm audit --omit=dev --json` was run independently from `admin`, `client`, `server` and `D:\irequestd\backend`. The saved counts reflect the registry at review time. No automatic fixes were applied.

The original invocation through `npm run build -- --outDir` was affected by this machine's npm/PowerShell argument forwarding; the successful build evidence uses the direct Vite commands above. That invocation issue is not classified as an application defect. A first browser run timed out waiting for an external landing-page asset; the final recorded run uses bounded visual-asset fetches. Initial kiosk automation selectors and fake-clock assumptions were corrected before the final evidence was saved.
