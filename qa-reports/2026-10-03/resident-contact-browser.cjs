// Local production bundle with synthetic API responses; no live account edits.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.LOCALAPPDATA, 'Temp/irequest-qa-20261003/node_modules/playwright'));
const build = 'D:/Temp/irequest-contact-qa-20261003/admin-build';
const shots = path.join(__dirname, 'resident-contact-screenshots');
fs.mkdirSync(shots, { recursive: true });
const results = [];
const id = '22222222-2222-4222-8222-222222222222';
const uid = '11111111-1111-4111-8111-111111111111';
function fixture() {
  return { id, _id: id, userId: uid, fullName: 'QA Resident', status: 'approved', archived: false, address: 'Purok 1, Dologon', facePhoto: '/qa-face.png', createdAt: '2026-09-01T00:00:00Z', email: 'old@example.invalid', contactNumber: '09999999999', user: { id: uid, email: 'old@example.invalid', contactNumber: '09999999999', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', deletedAt: null } };
}
async function main() {
  const server = http.createServer((req, res) => {
    let file = path.resolve(build, '.' + new URL(req.url, 'http://localhost').pathname);
    const root = path.resolve(build);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disk-cache-dir=D:/Temp/irequest-contact-qa-20261003/chrome-cache'] });
  async function scenario(name, run, { width = 1280, role = 'Barangay Captain' } = {}) {
    let profile = fixture(), mode = 'success'; const writes = [], errors = [];
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    await context.addInitScript(({ role }) => localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'synthetic-staff-token', user: { id: '33333333-3333-4333-8333-333333333333', fullName: 'QA Staff', role } }, version: 0 })), { role });
    await context.route('**/*', async (route) => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/verifications') return route.fulfill({ json: [profile] });
        if (url.pathname === '/api/verifications/' + id) return route.fulfill({ json: profile });
        if (url.pathname.endsWith('/contact') && request.method() === 'PATCH') {
          const body = request.postDataJSON(); writes.push(body);
          if (mode === 'duplicate') return route.fulfill({ status: 409, json: { field: 'email', message: 'Email is already registered to another resident.' } });
          if (mode === 'failure') return route.fulfill({ status: 500, json: { message: 'Could not save contact details. Please try again.' } });
          if (mode === 'stale') return route.fulfill({ status: 409, json: { message: 'This resident was updated by someone else. Reopen the profile and try again.' } });
          assert.equal(body.expectedUpdatedAt, profile.user.updatedAt);
          profile = { ...profile, email: body.email, contactNumber: body.contactNumber, user: { ...profile.user, email: body.email, contactNumber: body.contactNumber, updatedAt: '2026-10-03T12:00:00Z' } };
          return route.fulfill({ json: profile });
        }
        return route.fulfill({ json: [] });
      }
      if (url.pathname === '/qa-face.png') return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7n0AAAAASUVORK5CYII=', 'base64') });
      return request.url().startsWith(origin) ? route.continue() : route.abort();
    });
    const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', (e) => errors.push(e.message));
    const open = async () => { await page.getByRole('button', { name: 'Review', exact: true }).click(); await page.getByText('Review Profile', { exact: true }).waitFor(); };
    const edit = () => page.getByRole('button', { name: 'Edit contact details', exact: true }).click();
    const close = () => page.getByText('Review Profile', { exact: true }).locator('..').getByRole('button').click();
    const save = () => page.getByRole('button', { name: 'Save contact details', exact: true }).click();
    try {
      await page.goto(origin + (role === 'Secretary' ? '/secretary/residents' : '/captain/residents'));
      await open();
      await run({ page, open, edit, close, save, writes, mode: (value) => { mode = value; }, latest: (value) => { profile = { ...profile, ...value, user: { ...profile.user, ...value } }; } });
      assert.deepEqual(errors, []);
      await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: true });
      results.push({ name, passed: true }); console.log(name + ' passed');
    } catch (error) {
      await page.screenshot({ path: path.join(shots, name + '-failed.png'), fullPage: true });
      console.error(name, await page.locator('body').innerText()); throw error;
    } finally { await context.close(); }
  }
  try {
    for (const width of [1280, 390]) await scenario('captain-contact-edit-' + width, async ({ page, open, edit, close, save, writes }) => {
      await edit();
      assert.equal(await page.getByLabel('Email (optional)', { exact: true }).inputValue(), 'old@example.invalid');
      assert.equal(await page.getByLabel('Contact number', { exact: true }).inputValue(), '09999999999');
      await page.getByLabel('Email (optional)', { exact: true }).fill('  Updated@Example.invalid ');
      await page.getByLabel('Contact number', { exact: true }).fill('+63 977 777 7777');
      await page.getByRole('button', { name: 'Save contact details', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(shots, 'captain-contact-form-' + width + '.png'), fullPage: true });
      await save(); await page.getByRole('button', { name: 'Edit contact details' }).waitFor();
      assert.equal(writes[0].email, 'updated@example.invalid'); assert.equal(writes[0].contactNumber, '09777777777');
      await page.getByText('09777777777', { exact: true }).waitFor();
      await close(); await page.locator('tbody').getByText('updated@example.invalid', { exact: true }).waitFor();
      await page.reload(); await open(); await edit();
      assert.equal(await page.getByLabel('Email (optional)', { exact: true }).inputValue(), 'updated@example.invalid');
      await page.getByLabel('Email (optional)', { exact: true }).fill('discard@example.invalid');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await edit();
      assert.equal(await page.getByLabel('Email (optional)', { exact: true }).inputValue(), 'updated@example.invalid'); assert.equal(writes.length, 1);
      await page.getByLabel('Email (optional)', { exact: true }).fill(''); await save();
      await page.getByText('Not provided', { exact: true }).waitFor(); assert.equal(writes[1].email, '');
      await close(); await page.getByPlaceholder('Search name, address, email, contact, or special type…').fill('09777777777');
      assert.equal(await page.locator('tbody tr').count(), 1); await page.locator('tbody').getByText('QA Resident').waitFor();
    }, { width });
    await scenario('contact-validation-duplicate-and-retry', async ({ page, edit, save, writes, mode }) => {
      await edit();
      await page.getByLabel('Email (optional)', { exact: true }).fill('invalid'); await save(); await page.getByRole('alert').getByText('Enter a valid email address.').waitFor(); assert.equal(writes.length, 0);
      await page.getByLabel('Email (optional)', { exact: true }).fill('taken@example.invalid');
      await page.getByLabel('Contact number', { exact: true }).fill('123'); await save(); await page.getByRole('alert').waitFor(); assert.equal(writes.length, 0);
      await page.getByLabel('Contact number', { exact: true }).fill('09777777777'); mode('duplicate'); await save();
      await page.getByRole('alert').getByText('Email is already registered to another resident.').waitFor(); assert.equal(await page.getByLabel('Email (optional)', { exact: true }).inputValue(), 'taken@example.invalid');
      mode('failure'); await page.getByLabel('Email (optional)', { exact: true }).fill('retry@example.invalid'); await save();
      await page.getByRole('alert').getByText('Could not save contact details. Please try again.').waitFor();
      mode('success'); await save(); await page.getByRole('button', { name: 'Edit contact details' }).waitFor(); await page.getByText('09777777777', { exact: true }).waitFor();
    });
    await scenario('contact-stale-edit-reload', async ({ page, edit, save, mode, latest }) => {
      await edit(); await page.getByLabel('Email (optional)', { exact: true }).fill('my-edit@example.invalid');
      latest({ email: 'other-staff@example.invalid', updatedAt: '2026-10-03T11:00:00Z' }); mode('stale'); await save();
      await page.getByRole('button', { name: 'Reload latest details', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[name="residentEmail"]').value === 'other-staff@example.invalid');
      mode('success'); await page.getByLabel('Email (optional)', { exact: true }).fill('my-edit@example.invalid'); await save();
      await page.getByRole('button', { name: 'Edit contact details' }).waitFor();
    });
    await scenario('secretary-contact-remains-read-only', async ({ page }) => {
      assert.equal(await page.getByRole('button', { name: 'Edit contact details' }).count(), 0);
    }, { role: 'Secretary' });
  } finally {
    fs.writeFileSync(path.join(__dirname, 'resident-contact-browser-results.json'), JSON.stringify({ mode: 'Local production bundle, headless Chrome, intercepted synthetic API', results }, null, 2));
    await browser.close(); await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
