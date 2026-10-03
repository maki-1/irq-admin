// Local production builds with synthetic API responses only.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.LOCALAPPDATA, 'Temp/irequest-qa-20261003/node_modules/playwright'));
const root = path.resolve(__dirname, '../..');
const uid = '11111111-1111-4111-8111-111111111111';
const rid = '44444444-4444-4444-8444-444444444444';
const results = [];
const shots = path.join(__dirname, 'resident-improvements-screenshots');
fs.mkdirSync(shots, { recursive: true });
const fixture = () => ({ id: rid, _id: rid, userId: uid, documentType: 'Barangay Clearance', purpose: 'Employment',
  createdAt: '2026-10-01T01:00:00Z', updatedAt: '2026-10-02T01:00:00Z', status: 'Rejected',
  purokLeaderStatus: 'rejected', purokLeaderAt: '2026-10-02T01:00:00Z', purokLeaderRemarks: 'Please correct your purok address.',
  paymentStatus: 'unpaid', purokClearanceFee: 0, user: { username: 'QA Resident' }, profile: { fullName: 'QA Resident', address: 'Purok 1, Dologon' } });
async function serve(dir) {
  const folder = path.resolve(dir);
  const server = http.createServer((req, res) => {
    let file = path.resolve(folder, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(folder + path.sep)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(folder, 'index.html');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}
(async () => {
  const client = await serve(path.join(root, 'client/dist'));
  const admin = await serve(process.env.IMPROVEMENTS_ADMIN_BUILD || path.join(process.env.TEMP, 'irequest-admin-improvements-build'));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    async function scenario(name, run, { portal = 'client', role = 'Purok Leader', verified = true, width = 1280, requests = [] } = {}) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'America/Los_Angeles' });
      const origin = portal === 'client' ? client.origin : admin.origin;
      const writes = [], errors = [];
      const state = { requests, reads: 0, restoreFails: false, users: [] };
      const user = { id: uid, _id: uid, username: 'QA Resident', fullName: 'QA Leader', role, purok: 'Purok 1', active: true, isVerified: verified, verificationStep: 0 };
      await context.addInitScript(({ portal, user }) => {
        const key = portal === 'client' ? 'irequestd-auth' : 'auth-storage';
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ state: { token: 'synthetic-token', user }, version: 0 }));
      }, { portal, user });
      await context.route('**/*', (route) => {
        const req = route.request(), url = new URL(req.url()), p = url.pathname;
        if (p.startsWith('/api/')) {
          const reply = (status, json) => route.fulfill({ status, json, headers: { 'access-control-allow-origin': '*' } });
          if (req.method() === 'OPTIONS') return reply(200, {});
          if (req.method() !== 'GET') writes.push({ path: p, body: req.postDataJSON() });
          if (p.endsWith('/my/requests') || p.endsWith('/purok-leader/requests')) { state.reads++; return reply(200, state.requests); }
          if (p.endsWith('/restore')) {
            if (state.restoreFails) return reply(409, { message: 'This request has changed. Refresh the archive.' });
            state.requests = state.requests.map((r) => ({ ...r, status: 'Pending', purokLeaderStatus: 'pending', purokLeaderRemarks: '', purokLeaderAt: null }));
            return reply(200, state.requests[0]);
          }
          if (p.endsWith('/reject')) {
            state.requests = state.requests.map((r) => ({ ...r, status: 'Rejected', purokLeaderStatus: 'rejected', purokLeaderRemarks: req.postDataJSON().remarks, purokLeaderAt: new Date().toISOString() }));
            return reply(200, state.requests[0]);
          }
          if (p.endsWith('/users')) {
            if (req.method() === 'POST') { const created = { ...req.postDataJSON(), _id: 'new-user', active: true }; state.users.push(created); return reply(201, created); }
            return reply(200, state.users);
          }
          if (/\/users\//.test(p)) return reply(200, { ...state.users[0], ...req.postDataJSON() });
          if (p.endsWith('/summary')) return reply(200, { total: state.requests.length, pending: 0, processing: 0, printing: 0, ready: 0, claimed: 0, rejected: state.requests.length, readyDocuments: [] });
          if (p.endsWith('/verification/status')) return reply(200, { fullName: 'QA Resident', isVerified: true });
          if (p.endsWith('/auth/me')) return reply(200, user);
          return reply(200, []);
        }
        return req.url().startsWith(origin) ? route.continue() : route.abort();
      });
      const page = await context.newPage(); page.setDefaultTimeout(8000);
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await run({ page, context, origin, state, writes });
        assert.deepEqual(errors, []);
        results.push({ name, passed: true }); console.log('PASS ' + name);
      } catch (error) {
        await page.screenshot({ path: path.join(shots, 'failure.png'), fullPage: true }).catch(() => {});
        console.error('Scenario failed:', name, errors); throw error;
      } finally { await context.close(); }
    }

    await scenario('Birthday picker rejects future dates and permits today in Philippine time', async ({ page, origin, writes }) => {
      await page.clock.install({ time: new Date('2026-10-02T16:00:00Z') });
      await page.goto(origin + '/verify/step1');
      const birthday = page.locator('input[name="birthday"]');
      assert.equal(await birthday.getAttribute('max'), '2026-10-03');
      await birthday.fill('2026-10-04');
      assert.equal(await birthday.evaluate((input) => input.validity.rangeOverflow), true);
      await page.locator('button[type="submit"]').click(); assert.equal(writes.length, 0);
      await birthday.fill('2026-10-03');
      assert.equal(await birthday.evaluate((input) => input.checkValidity()), true);
      await page.screenshot({ path: path.join(shots, 'birthday.png'), fullPage: true });
    }, { verified: false });

    await scenario('Admin create/edit contact allows only 11 numeric digits', async ({ page, origin, writes }) => {
      await page.goto(origin + '/captain/users');
      await page.getByRole('button', { name: 'Create Account', exact: true }).click();
      await page.getByPlaceholder('e.g. Juan Dela Cruz').fill('QA Staff');
      await page.getByPlaceholder('e.g. juan@email.com').fill('qa@example.invalid');
      await page.getByPlaceholder('Min. 6 characters').fill('synthetic-password');
      const contact = page.getByPlaceholder('e.g. 09171234567');
      await contact.fill('09ab123'); assert.equal(await contact.inputValue(), '09123');
      await page.getByRole('button', { name: 'Create Account', exact: true }).last().click();
      await page.getByText('Contact number must contain exactly 11 digits and start with 09.', { exact: true }).waitFor();
      assert.equal(writes.length, 0);
      await contact.fill('091234567890123'); assert.equal(await contact.inputValue(), '09123456789');
      await page.getByRole('button', { name: 'Create Account', exact: true }).last().click();
      await page.getByText('Account created for QA Staff', { exact: true }).waitFor();
      assert.equal(writes[0].body.contactNumber, '09123456789');
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      assert.equal(await contact.getAttribute('maxlength'), '11');
      await contact.fill('0999'); await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
      assert.equal(writes.length, 1);
      await contact.fill('09987654321'); await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
      await page.getByText('QA Staff updated', { exact: true }).waitFor();
      assert.equal(writes[1].body.contactNumber, '09987654321');
    }, { portal: 'admin', role: 'Barangay Captain' });

    for (const width of [1280, 390]) {
      await scenario(`Purok archive restore, conflict handling and re-rejection at ${width}px`, async ({ page, origin, state, writes }) => {
        await page.goto(origin + '/purok-leader/requests');
        await page.getByRole('button', { name: 'Archive', exact: true }).click();
        await page.getByRole('button', { name: 'Restore', exact: true }).locator('visible=true').click();
        await page.getByText('Restore Request', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(writes.length, 0);
        await page.screenshot({ path: path.join(shots, `archive-${width}.png`), fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.getByRole('button', { name: 'Restore', exact: true }).locator('visible=true').click();
        state.restoreFails = true;
        await page.getByRole('button', { name: 'Restore', exact: true }).first().click();
        await page.getByText('This request has changed. Refresh the archive.', { exact: true }).waitFor();
        assert.equal(state.requests[0].purokLeaderStatus, 'rejected');
        state.restoreFails = false;
        await page.getByRole('button', { name: 'Restore', exact: true }).first().click();
        await page.getByText('Request restored to Pending', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Reject', exact: true }).locator('visible=true').click();
        await page.locator('textarea').fill('Still needs an address correction.');
        await page.getByRole('button', { name: 'Reject', exact: true }).first().click();
        await page.getByRole('button', { name: 'Archive', exact: true }).click();
        await page.getByText('Still needs an address correction.', { exact: false }).locator('visible=true').waitFor();
        assert.equal(state.requests[0].purokLeaderStatus, 'rejected');
      }, { portal: 'admin', width, requests: [fixture()] });
    }

    await scenario('Resident popup shows reason, focuses actions, opens Rejected and persists acknowledgment', async ({ page, origin }) => {
      await page.goto(origin + '/dashboard');
      const popup = page.getByRole('alertdialog'); await popup.waitFor();
      await popup.getByText('Please correct your purok address.', { exact: true }).waitFor();
      assert.equal(await popup.getByRole('button', { name: 'OK', exact: true }).evaluate((el) => el === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await popup.getByRole('button', { name: 'View requests' }).evaluate((el) => el === document.activeElement), true);
      await page.screenshot({ path: path.join(shots, 'resident-rejected-mobile.png'), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await popup.getByRole('button', { name: 'View requests' }).click();
      await page.waitForURL('**/requests?tab=rejected');
      await page.getByText('Please correct your purok address.', { exact: false }).waitFor();
      assert.equal(await popup.count(), 0);
      await page.reload();
      await page.getByText('Please correct your purok address.', { exact: false }).waitFor(); assert.equal(await popup.count(), 0);
      const saved = await page.evaluate((uid) => JSON.parse(localStorage.getItem(`irequestd-rejections:${uid}`)), uid);
      assert.deepEqual(saved, [`${rid}:2026-10-02T01:00:00Z`]);
    }, { width: 390, requests: [fixture()] });

    await scenario('Resident polling catches new rejection, closes restored notice and shows a later rejection again', async ({ page, origin, state }) => {
      await page.clock.install(); await page.goto(origin + '/dashboard');
      await page.getByText('Recent Requests', { exact: true }).waitFor();
      const popup = page.getByRole('alertdialog'); assert.equal(await popup.count(), 0);
      state.requests = [fixture()]; await page.clock.runFor(15001); await popup.waitFor();
      await page.keyboard.press('Escape'); assert.equal(await popup.count(), 0);
      await page.clock.runFor(15001); assert.equal(await popup.count(), 0);
      state.requests = [{ ...fixture(), purokLeaderStatus: 'pending', status: 'Pending', purokLeaderAt: null }];
      await page.clock.runFor(15001); assert.equal(await popup.count(), 0);
      state.requests = [{ ...fixture(), purokLeaderAt: '2026-10-03T03:00:00Z', purokLeaderRemarks: 'A second review was rejected.' }];
      await page.clock.runFor(15001); await popup.getByText('A second review was rejected.', { exact: true }).waitFor();
      state.requests = [{ ...fixture(), purokLeaderStatus: 'pending', status: 'Pending', purokLeaderAt: null }];
      const response = page.waitForResponse((r) => r.url().endsWith('/my/requests'));
      await page.clock.runFor(15001); await response; await popup.waitFor({ state: 'hidden' });
      assert.ok(state.reads >= 5);
    });

    await scenario('Multiple rejection notices are individually acknowledged with a fallback reason', async ({ page, origin }) => {
      await page.goto(origin + '/requests');
      const popup = page.getByRole('alertdialog'); await popup.waitFor();
      await popup.getByText('1 more rejection notice(s) to review.', { exact: true }).waitFor();
      await popup.getByRole('button', { name: 'OK', exact: true }).click();
      await popup.getByText('No reason was provided. Please contact your Purok Leader for details.', { exact: true }).waitFor();
      await popup.getByRole('button', { name: 'OK', exact: true }).click(); assert.equal(await popup.count(), 0);
    }, { requests: [fixture(), { ...fixture(), _id: 'other-request', id: 'other-request', purokLeaderRemarks: '', purokLeaderAt: '2026-10-01T01:00:00Z' }] });

    fs.writeFileSync(path.join(__dirname, 'resident-improvements-browser-results.json'), JSON.stringify({ localOnly: true, results }, null, 2) + '\n');
    console.log(`${results.length} browser scenarios passed.`);
  } finally {
    await browser.close();
    await Promise.all([client.server, admin.server].map((server) => new Promise((resolve) => server.close(resolve))));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
