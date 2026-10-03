// Production admin bundle; intercepted synthetic APIs and blocked external traffic.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.LOCALAPPDATA, 'Temp/irequest-qa-20261003/node_modules/playwright'));
const build = process.env.ADMIN_QA_BUILD || 'D:/Temp/irequest-contact-qa-20261003/admin-build';
const temp = 'D:/Temp/irequest-approval-qa-20261003';
const shots = path.join(__dirname, 'approval-screenshots');
fs.mkdirSync(temp, { recursive: true }); fs.mkdirSync(shots, { recursive: true });
process.env.TEMP = temp; process.env.TMP = temp;
const results = [];
const params = { lid: '11111111-1111-4111-8111-111111111111', exp: String(Date.now() + 60000), sig: 'synthetic-browser-signature', v: '2' };
const requests = [
  { id: '22222222-2222-4222-8222-222222222222', residentName: 'QA Kiosk Resident', residentAddress: 'Purok 10, Dologon', documentType: 'Certificate of Residency', purpose: 'Employment', channel: 'kiosk' },
  { id: '33333333-3333-4333-8333-333333333333', residentName: 'QA Web Resident', residentAddress: 'Purok 10, Dologon', documentType: 'Certificate of Indigency', purpose: 'Scholarship', channel: 'web' },
];
async function main() {
  const server = http.createServer((req, res) => {
    const root = path.resolve(build); let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disk-cache-dir=' + temp + '/chrome-cache'] });
  async function scenario(name, run, { width = 390, mode = 'success', signedIn = false } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 880 } });
    const calls = []; const errors = []; let actionStatus = 200;
    if (signedIn) await context.addInitScript(() => {
      if (sessionStorage.getItem('qa-auth-initialized')) return;
      sessionStorage.setItem('qa-auth-initialized', '1');
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'qa-staff-token', user: { role: 'Purok Leader', fullName: 'QA Leader' } }, version: 0 }));
    });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname === '/api/purok-approve/pending') {
        calls.push({ type: 'pending', params: Object.fromEntries(url.searchParams) });
        return route.fulfill({ status: mode === 'expired' ? 401 : 200, json: mode === 'expired' ? { ok: false, message: 'This approval link is invalid or has expired.' } : { ok: true, leader: { fullName: 'QA Leader', purok: 'Purok 10' }, requests: mode === 'empty' ? [] : requests } });
      }
      if (url.pathname === '/api/purok-approve/action') {
        const body = request.postDataJSON(); calls.push({ type: 'action', body });
        await new Promise(resolve => setTimeout(resolve, 200));
        return route.fulfill({ status: actionStatus, json: actionStatus === 200 ? { ok: true, action: body.action } : { ok: false, message: 'QA: temporary action failure, please retry.' } });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: [] });
      return url.origin === origin ? route.continue() : route.abort();
    });
    const page = await context.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(origin + '/purok-approve?' + new URLSearchParams(params));
      await run({ page, calls, failAction: status => { actionStatus = status; } });
      assert.deepEqual(errors, []);
      await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: true });
      results.push({ name, passed: true });
    } catch (e) {
      results.push({ name, passed: false, message: e.message });
      await page.screenshot({ path: path.join(shots, name + '-failed.png'), fullPage: true });
    } finally { await context.close(); }
    console.log((results.at(-1).passed ? 'PASS ' : 'FAIL ') + name);
  }
  try {
    for (const width of [1280, 390]) await scenario('approve-and-reject-' + width, async ({ page, calls }) => {
      await page.getByText('Purok Clearance Approval', { exact: true }).waitFor(); await page.getByText('AT COUNTER').waitFor();
      assert.deepEqual(calls.find(c => c.type === 'pending').params, params);
      await page.getByRole('button', { name: 'Approve', exact: true }).first().click();
      assert.equal(await page.getByRole('button', { name: 'Reject', exact: true }).first().isDisabled(), true);
      await page.getByText('✓ Approved', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Reject', exact: true }).click();
      await page.getByText('✕ Rejected', { exact: true }).waitFor();
      await page.getByText('All done — thank you!', { exact: true }).waitFor();
      assert.deepEqual(calls.filter(c => c.type === 'action').map(c => c.body), [ { ...params, requestId: requests[0].id, action: 'approve' }, { ...params, requestId: requests[1].id, action: 'reject' } ]);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }, { width });
    await scenario('expired-link-anonymous', async ({ page, calls }) => { await page.getByText('This approval link is invalid or has expired.', { exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Approve', exact: true }).count(), 0); assert.equal(calls.filter(c => c.type === 'action').length, 0); }, { mode: 'expired' });
    await scenario('empty-pending-queue', async ({ page }) => { await page.getByText(/No pending requests right now/).waitFor(); assert.equal(await page.getByRole('button', { name: 'Approve', exact: true }).count(), 0); }, { mode: 'empty' });
    await scenario('failed-action-can-retry', async ({ page, calls, failAction }) => {
      failAction(500); const dialogPromise = page.waitForEvent('dialog');
      await page.getByRole('button', { name: 'Approve', exact: true }).first().click(); const dialog = await dialogPromise;
      assert.match(dialog.message(), /temporary action failure/); await dialog.accept();
      await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent === 'Approve' && !b.disabled));
      assert.equal(await page.getByText('✓ Approved', { exact: true }).count(), 0);
      failAction(200); await page.getByRole('button', { name: 'Approve', exact: true }).first().click(); await page.getByText('✓ Approved', { exact: true }).waitFor();
      assert.equal(calls.filter(c => c.type === 'action').length, 2);
    });
    await scenario('expired-link-preserves-existing-login', async ({ page }) => {
      await page.waitForTimeout(600);
      assert.equal(new URL(page.url()).pathname, '/purok-approve', 'An invalid public approval link redirected an already-signed-in user to login');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('auth-storage')).state.token), 'qa-staff-token');
    }, { mode: 'expired', signedIn: true });
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
  const report = { testedAt: new Date().toISOString(), build, scope: 'Local production bundle, synthetic APIs, external traffic blocked.', total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results };
  fs.writeFileSync(path.join(__dirname, 'approval-browser-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed })); process.exitCode = report.failed ? 1 : 0;
}
main().catch(e => { console.error(e); process.exitCode = 2; });
