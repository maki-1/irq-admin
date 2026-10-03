// Local production bundles with intercepted APIs and synthetic residents.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const temp = path.join(process.env.TEMP, 'irequest-qa-20261003');
const { chromium } = require(path.join(temp, 'node_modules/playwright'));
const results = [];
const screenshots = path.join(__dirname, 'pickup-screenshots');
fs.mkdirSync(screenshots, { recursive: true });
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
const user = { id: '11111111-1111-4111-8111-111111111111', _id: '11111111-1111-4111-8111-111111111111', username: 'qa-resident', fullName: 'QA Resident', email: 'qa@example.invalid', contactNumber: '09999999999', isVerified: true, role: 'Secretary', purok: 'Purok 1' };
function request(index, status) {
  const id = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  return { id, _id: id, status, user, profile: { fullName: user.fullName, address: 'Purok 1', facePhoto: '/qa-face.jpg' }, documentType: `QA Document ${index}`, purpose: 'Employment', paymentStatus: 'paid', purokLeaderStatus: 'approved', channel: index % 2 ? 'web' : 'kiosk', createdAt: '2026-09-01T00:00:00Z' };
}
function document(index, claimed = false) {
  const req = request(index, claimed ? 'Claimed' : 'Ready for Pickup');
  return { ...req, claimCode: `CLM-PICKUP-${index}`, request: req, requestId: req.id, claimStatus: claimed ? 'claimed' : 'pending', completedAt: '2026-09-02T00:00:00Z', claimedAt: claimed ? '2026-10-03T00:00:00Z' : null };
}
async function scenario(browser, site, name, { role, width = 1280, handler, run, start }) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const key = role ? 'auth-storage' : 'irequestd-auth';
  await context.addInitScript(({ key, user }) => localStorage.setItem(key, JSON.stringify({ state: { user, token: 'qa-fixture' }, version: 0 })), { key, user: { ...user, ...(role ? { role } : {}) } });
  await context.route('**/*', async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.pathname.startsWith('/api/')) {
      const response = await handler(url.pathname, req.method(), req.postDataJSON());
      return route.fulfill(response || { json: [] });
    }
    return req.url().startsWith(site.url) ? route.continue() : route.abort();
  });
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(site.url + start);
    await run(page);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(screenshots, name + '.png'), fullPage: true });
    results.push({ name, passed: true, pageErrors: errors }); console.log(name + ' passed');
  } catch (error) {
    console.error(name, await page.locator('body').innerText(), errors);
    await page.screenshot({ path: path.join(screenshots, name + '-failed.png'), fullPage: true });
    throw error;
  } finally { await context.close(); }
}
async function waitCount(page, label, value) {
  const card = page.locator('p').filter({ hasText: new RegExp('^' + label + '$') }).locator('..').locator('.stat-value');
  await card.waitFor();
  await page.waitForFunction(({ label, value }) => [...document.querySelectorAll('p')].some((p) => p.textContent === label && p.parentElement.querySelector('.stat-value')?.textContent === String(value)), { label, value });
}
async function main() {
  const resident = await serve(path.join(temp, 'pickup-client-build'));
  const admin = await serve(path.join(temp, 'pickup-admin-build'));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [1280, 390]) {
      let claimed = 0;
      await scenario(browser, resident, `resident-pickup-${width}`, {
        width, start: '/dashboard',
        handler: async (url) => {
          const ready = [document(7), document(8)].slice(claimed);
          if (url.endsWith('/summary')) return { json: { total: 8, pending: 4, processing: 1, printing: 1, ready: ready.length, claimed, rejected: 0, readyDocuments: ready } };
          if (url === '/api/my/requests') return { json: [request(1, 'Pending'), request(2, 'Processing'), request(3, 'Printing'), request(4, 'Pending'), request(5, 'Pending'), request(6, 'Pending'), request(7, claimed > 0 ? 'Claimed' : 'Ready for Pickup'), request(8, claimed > 1 ? 'Claimed' : 'Ready for Pickup')] };
          if (url.includes('/verification/status')) return { json: { status: 'approved', isVerified: true, fullName: user.fullName } };
          return { json: user };
        },
        run: async (page) => {
          await waitCount(page, 'Ready for Pickup', 2); await waitCount(page, 'Printing', 1);
          await page.getByText('CLM-PICKUP-7', { exact: true }).waitFor(); await page.getByText('CLM-PICKUP-8', { exact: true }).waitFor();
          assert.equal(await page.getByText('QA Document 7', { exact: true }).count(), 1, 'Older pickup must appear outside the recent-five list');
          await page.screenshot({ path: path.join(screenshots, `resident-two-ready-${width}.png`), fullPage: true });
          claimed = 1; await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
          await waitCount(page, 'Ready for Pickup', 1); await waitCount(page, 'Claimed', 1);
          assert.equal(await page.getByText('CLM-PICKUP-7', { exact: true }).count(), 0);
          claimed = 2; await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
          await waitCount(page, 'Ready for Pickup', 0); await waitCount(page, 'Claimed', 2);
          assert.equal(await page.locator('.card-dark').count(), 0);
        },
      });
    }
    let outage = true;
    await scenario(browser, resident, 'resident-summary-error-and-retry', {
      start: '/dashboard',
      handler: async (url) => url.endsWith('/summary')
        ? (outage ? { status: 500, json: { message: 'Test outage' } } : { json: { total: 0, pending: 0, processing: 0, printing: 0, ready: 0, claimed: 0, rejected: 0, readyDocuments: [] } })
        : { json: url.includes('/verification/status') ? { status: 'approved', isVerified: true } : [] },
      run: async (page) => {
        await page.getByRole('alert').waitFor(); assert.equal(await page.locator('.stat-value').count(), 0);
        outage = false; await page.getByRole('button', { name: 'Try again' }).click();
        await waitCount(page, 'Ready for Pickup', 0);
      },
    });
    for (const [role, prefix] of [['Secretary', 'secretary'], ['Barangay Captain', 'captain']]) {
      let rows = [request(1, 'Printing'), request(2, 'Ready for Pickup'), request(3, 'Claimed')];
      await scenario(browser, admin, `${prefix}-canonical-statuses`, {
        role, start: `/${prefix}/requests`,
        handler: async (url, method, body) => {
          if (url === '/api/requests') return { json: rows };
          if (url.endsWith('/status') && method === 'PATCH') {
            assert.equal(body.status, 'Ready for Pickup'); rows[0] = { ...rows[0], status: body.status }; return { json: rows[0] };
          }
          return { json: [] };
        },
        run: async (page) => {
          await page.getByRole('button', { name: 'Mark ready', exact: true }).click();
          await page.getByRole('button', { name: 'Ready for Pickup', exact: true }).click();
          await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 2);
          assert.equal(await page.getByRole('button', { name: 'Reprint', exact: true }).count(), 2);
          await page.getByRole('button', { name: 'Claimed', exact: true }).click();
          await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
          assert.equal(await page.getByRole('button', { name: 'Reprint', exact: true }).count(), 0);
        },
      });
    }
    const docs = [document(1), document(2, true)];
    await scenario(browser, admin, 'secretary-release-label-and-handover', {
      role: 'Secretary', start: '/secretary/releases',
      handler: async (url, method, body) => {
        if (url === '/api/releases') return { json: docs };
        if (url.endsWith('/claim-status') && method === 'PATCH') {
          assert.equal(body.claimStatus, 'claimed'); docs[0] = document(1, true); return { json: docs[0] };
        }
        return { json: [] };
      },
      run: async (page) => {
        await page.getByText('Ready for Pickup', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Mark claimed', exact: true }).click();
        await page.waitForFunction(() => ![...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Mark claimed'));
        assert.equal(await page.getByText('Ready for Pickup', { exact: true }).count(), 0);
      },
    });
  } finally {
    fs.writeFileSync(path.join(__dirname, 'pickup-browser-results.json'), JSON.stringify({ mode: 'Local production builds; mocked API; headless Chrome', results }, null, 2));
    await browser.close(); await Promise.all([resident, admin].map(({ server }) => new Promise((resolve) => server.close(resolve))));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
