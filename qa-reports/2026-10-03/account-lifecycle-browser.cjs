// Production frontend bundles with synthetic API responses; no live requests.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const temp = path.join(process.env.TEMP, 'irequest-qa-20261003');
const { chromium } = require(path.join(temp, 'node_modules/playwright'));
async function serve(root) {
  const server = http.createServer((req, res) => {
    let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
async function main() {
  const sites = {
    admin: await serve(path.join(temp, 'lifecycle-admin-build')),
    resident: await serve(path.join(temp, 'lifecycle-client-build')),
  };
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const results = [];
  try {
    for (const [site, { url }] of Object.entries(sites)) {
      for (const scenario of ['password-change', 'deactivated', 'revoked']) {
        const context = await browser.newContext();
        const key = site === 'admin' ? 'auth-storage' : 'irequestd-auth';
        const user = { id: '11111111-1111-4111-8111-111111111111', username: 'qa-resident', fullName: 'QA User', email: 'qa@example.invalid', contactNumber: '09999999999', isVerified: true, role: 'Secretary', purok: 'Purok 1' };
        await context.addInitScript(({ key, user }) => {
          if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ state: { user, token: 'isolated-fixture' }, version: 0 }));
        }, { key, user });
        let passwordWrites = 0;
        await context.route('**/*', async (route) => {
          const request = route.request(), target = new URL(request.url());
          if (target.pathname.startsWith('/api/')) {
            if (target.pathname.endsWith('/logout')) return route.fulfill({ status: 204 });
            if (scenario !== 'password-change') return route.fulfill({ status: scenario === 'deactivated' ? 403 : 401, json: { code: scenario === 'deactivated' ? 'ACCOUNT_DISABLED' : 'SESSION_REVOKED', message: 'Please sign in again.' } });
            if (request.method() !== 'GET' && (target.pathname.endsWith('/change-password') || target.pathname.endsWith('/users/me'))) {
              passwordWrites++; return route.fulfill({ json: { ...user, sessionsRevoked: true, message: 'Password changed. Please sign in again.' } });
            }
            const payload = target.pathname.includes('/verification/status') ? { status: 'approved', isVerified: true, fullName: user.fullName }
              : target.pathname.endsWith('/auth/me') || target.pathname.endsWith('/users/me') ? user : [];
            return route.fulfill({ json: payload });
          }
          if (request.url().startsWith(url)) return route.continue();
          return route.abort();
        });
        const page = await context.newPage();
        const errors = []; page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(url + (site === 'admin' ? '/secretary/profile' : '/profile'));
        if (scenario === 'password-change') {
          const inputs = page.locator('input[type="password"]');
          await inputs.nth(0).fill('Initial-password-123');
          await inputs.nth(1).fill('Replacement-password-456');
          await inputs.nth(2).fill('Replacement-password-456');
          await page.getByRole('button', { name: 'Update Password', exact: true }).click();
        }
        await page.waitForURL('**/login');
        await page.waitForLoadState('networkidle');
        const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).state, key);
        assert.equal(state.token, null); assert.equal(state.user, null); assert.deepEqual(errors, []);
        if (scenario === 'password-change') assert.equal(passwordWrites, 1);
        results.push({ site, scenario, passed: true, storageCleared: true, redirectedTo: '/login', pageErrors: errors });
        console.log(`${site}: ${scenario} passed`);
        await context.close();
      }
    }
  } finally {
    fs.writeFileSync(path.join(__dirname, 'account-lifecycle-browser-results.json'), JSON.stringify({ mode: 'Local production builds, mocked API, headless Chrome', results }, null, 2));
    await browser.close();
    await Promise.all(Object.values(sites).map(({ server }) => new Promise((resolve) => server.close(resolve))));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
