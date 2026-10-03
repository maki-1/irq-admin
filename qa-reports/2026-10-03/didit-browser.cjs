// Browser checks use local builds and synthetic responses; never real residents.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.LOCALAPPDATA, 'Temp/irequest-qa-20261003/node_modules/playwright'));
const root = path.resolve(__dirname, '../..');
const uid = '11111111-1111-4111-8111-111111111111';
const pid = '22222222-2222-4222-8222-222222222222';
const saved = { resumeToken: 'synthetic-resume', url: 'https://verify.didit.me/session/synthetic' };
const key = `irq-didit-session:${uid}`;
const results = [];
const screenshotDir = path.join(__dirname, 'didit-screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

async function serve(dir) {
  const server = http.createServer((req, res) => {
    const rootDir = path.resolve(dir);
    let file = path.resolve(rootDir, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(rootDir + path.sep)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(rootDir, 'index.html');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: 'http://127.0.0.1:' + server.address().port };
}

(async () => {
  const client = await serve(path.join(root, 'client/dist'));
  const admin = await serve(process.env.DIDIT_ADMIN_BUILD || path.join(root, 'admin/dist'));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    async function scenario(name, run, { resume = true, width = 1280 } = {}) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      const errors = [], writes = [];
      let mode = 'approved', submitFails = false;
      await context.addInitScript(({ uid, key, saved, resume }) => {
        if (!localStorage.getItem('irequestd-auth')) localStorage.setItem('irequestd-auth', JSON.stringify({ state: { token: 'synthetic-token', user: { id: uid, isVerified: false, verificationStep: 2 } }, version: 0 }));
        if (resume && !sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify(saved));
      }, { uid, key, saved, resume });
      await context.route('**/*', (route) => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname.startsWith('/api/')) {
          const reply = (status, json) => route.fulfill({ status, json, headers: { 'access-control-allow-origin': '*' } });
          if (url.pathname.endsWith('/identity/session')) {
            writes.push({ path: 'start', body: req.postDataJSON() });
            return reply(200, saved);
          }
          if (url.pathname.endsWith('/identity/complete')) {
            writes.push({ path: 'complete', body: req.postDataJSON() });
            if (mode === 'pending') return reply(202, { status: 'pending', message: 'Your identity check is being reviewed. Check the result later.' });
            if (mode === 'expired') return reply(403, { code: 'VERIFICATION_EXPIRED', message: 'Your verification session expired. Please start again.' });
            return reply(200, { status: 'approved', verificationProof: 'synthetic-proof', idType: 'Identity Card', idName: 'QA Resident' });
          }
          if (url.pathname.endsWith('/step3')) {
            writes.push({ path: 'submit', body: req.postDataJSON() });
            return submitFails ? reply(503, { message: 'Submission temporarily unavailable.' }) : reply(200, { step: 3 });
          }
          if (url.pathname.endsWith('/status')) return reply(200, { status: 'pending', isVerified: false, verificationStep: 3 });
          return reply(200, {});
        }
        if (url.hostname === 'verify.didit.me') return route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic Didit page</h1>' });
        return req.url().startsWith(client.origin) ? route.continue() : route.abort();
      });
      const page = await context.newPage(); page.setDefaultTimeout(8000);
      page.on('pageerror', (err) => errors.push(err.message));
      try {
        await run({ page, writes, open: (query = '') => page.goto(client.origin + '/verify/step3' + query), setMode: (value) => { mode = value; }, failSubmit: (value) => { submitFails = value; } });
        assert.deepEqual(errors, []);
        results.push({ name, passed: true });
      } finally { await context.close(); }
    }

    await scenario('Mobile start screen and Didit redirect', async ({ page, open, writes }) => {
      await open();
      assert.equal(await page.getByRole('button', { name: 'Submit for Review' }).isDisabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.screenshot({ path: path.join(screenshotDir, 'mobile-start.png'), fullPage: true });
      await page.getByRole('button', { name: 'Start ID & Face Check' }).click();
      await page.waitForURL('https://verify.didit.me/**');
      assert.ok(writes.some((w) => w.path === 'start'));
      await open('?verification=return&status=Declined');
      await page.getByText('Identity check completed', { exact: true }).waitFor();
    }, { resume: false, width: 390 });

    await scenario('Server approval overrides callback text; submit clears resume state', async ({ page, open, writes }) => {
      await open('?verification=return&status=Declined&verificationSessionId=forged');
      await page.getByText('Identity check completed', { exact: true }).waitFor();
      assert.ok(writes.filter((w) => w.path === 'complete').every((w) => Object.keys(w.body).join() === 'resumeToken' && w.body.resumeToken === saved.resumeToken));
      await page.screenshot({ path: path.join(screenshotDir, 'desktop-approved.png'), fullPage: true });
      await page.getByRole('button', { name: 'Submit for Review' }).click();
      await page.waitForURL('**/verify/waiting');
      assert.deepEqual(writes.find((w) => w.path === 'submit').body, { verificationProof: 'synthetic-proof' });
      assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), key), null);
    });

    await scenario('Pending cannot submit even with Approved callback; manual retry succeeds', async ({ page, open, setMode }) => {
      setMode('pending'); await open('?verification=return&status=Approved');
      await page.getByRole('alert').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Submit for Review' }).isDisabled(), true);
      setMode('approved'); await page.getByRole('button', { name: 'Check result' }).click();
      await page.getByText('Identity check completed', { exact: true }).waitFor();
    });

    await scenario('Expired resume permits a new check', async ({ page, open, setMode }) => {
      setMode('expired'); await open('?verification=return');
      await page.getByText('Your verification session expired. Please start again.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Submit for Review' }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Start ID & Face Check' }).count(), 1);
    });

    await scenario('Missing resume token explains recovery and does not trust callback', async ({ page, open, writes }) => {
      await open('?verification=return&status=Approved');
      await page.getByRole('alert').waitFor();
      assert.equal(writes.length, 0);
      assert.equal(await page.getByRole('button', { name: 'Submit for Review' }).isDisabled(), true);
    }, { resume: false });

    await scenario('Refresh restores result; failed submission can be retried', async ({ page, open, writes, failSubmit }) => {
      await open(); await page.getByText('Identity check completed', { exact: true }).waitFor();
      await page.reload(); await page.getByText('Identity check completed', { exact: true }).waitFor();
      failSubmit(true); await page.getByRole('button', { name: 'Submit for Review' }).click();
      await page.getByText('Submission temporarily unavailable.', { exact: true }).waitFor();
      failSubmit(false); await page.getByRole('button', { name: 'Submit for Review' }).click();
      await page.waitForURL('**/verify/waiting');
      assert.equal(writes.filter((w) => w.path === 'submit').length, 2);
    });

    for (const role of ['Barangay Captain', 'Secretary']) {
      const context = await browser.newContext();
      const errors = [];
      const profile = { id: pid, _id: pid, userId: uid, fullName: 'QA Resident', idName: 'QA Resident', idType: 'Identity Card', status: 'Pending', createdAt: new Date().toISOString(), facePhoto: '/qa.png', idFront: '/qa.png', idBack: '/qa.png', aiVerification: { provider: 'didit', idStatus: 'Approved', livenessStatus: 'Approved', faceMatchStatus: 'Approved' }, user: { id: uid, email: 'qa@example.invalid', contactNumber: '09999999999', active: true, createdAt: new Date().toISOString() } };
      await context.addInitScript(({ role }) => localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'synthetic-staff-token', user: { id: 'qa-staff', role, fullName: 'QA Staff' } }, version: 0 })), { role });
      await context.route('**/*', (route) => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: url.pathname.endsWith('/verifications') ? [profile] : url.pathname.endsWith('/' + pid) ? profile : [] });
        if (url.pathname === '/qa.png') return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7n0AAAAASUVORK5CYII=', 'base64') });
        return req.url().startsWith(admin.origin) ? route.continue() : route.abort();
      });
      const page = await context.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(admin.origin + (role === 'Barangay Captain' ? '/captain/residents' : '/secretary/residents'));
      await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page.getByRole('heading', { name: 'Identity verification checks' }).waitFor();
      await page.getByRole('button', { name: 'ID Front', exact: true }).waitFor();
      assert.deepEqual(errors, []);
      results.push({ name: role + ' sees verified document checks', passed: true });
      await context.close();
    }
  } finally {
    await browser.close();
    client.server.close(); admin.server.close();
    fs.writeFileSync(path.join(__dirname, 'didit-browser-results.json'), JSON.stringify(results, null, 2));
  }
  console.log(JSON.stringify(results, null, 2));
})().catch((err) => { console.error(err); process.exitCode = 1; });
