// Registration UI observations from the current local production bundle.
// All API/provider requests are intercepted; no real registration is created.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const temp = path.join(process.env.TEMP, 'irequest-qa-20261003');
const { chromium } = require(path.join(temp, 'node_modules/playwright'));
const root = path.join(temp, 'pickup-client-build');
const results = [];
const screenshots = path.join(__dirname, 'registration-screenshots');
fs.mkdirSync(screenshots, { recursive: true });
async function main() {
  const server = http.createServer((req, res) => {
    let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  async function scenario(name, { username = 'qa_resident', password = 'Registration-QA-123!', phone = '09999999999', email = '', channel = 'sms', expectedError, inspect }) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const posts = [], errors = [];
    await context.route('**/*', async (route) => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname.includes('/check-')) return route.fulfill({ json: { available: true } });
        if (url.pathname.endsWith('/register')) {
          posts.push(request.postDataJSON());
          return route.fulfill({ status: 201, json: { userId: '11111111-1111-4111-8111-111111111111', channel, sentTo: channel === 'sms' ? '0999***999' : 'qa***@example.invalid', message: 'Account created. Verification code sent to your email.' } });
        }
        return route.fulfill({ json: {} });
      }
      return request.url().startsWith(origin) ? route.continue() : route.abort();
    });
    const page = await context.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(origin + '/signup');
      for (const [name, value] of Object.entries({ username, contactNumber: phone, email, password, confirmPassword: password })) await page.locator('[name="' + name + '"]').fill(value);
      await page.getByRole('button', { name: 'Create Account', exact: true }).click();
      if (expectedError) {
        await page.getByText(expectedError, { exact: true }).waitFor(); assert.equal(posts.length, 0);
      } else {
        await page.waitForURL('**/otp'); assert.equal(posts.length, 1);
      }
      const details = inspect ? await inspect(page, posts) : {};
      assert.deepEqual(errors, []);
      await page.screenshot({ path: path.join(screenshots, name + '.png'), fullPage: true });
      results.push({ name, reproduced: true, ...details }); console.log('CONFIRMED ' + name);
    } finally { await context.close(); }
  }
  try {
    await scenario('web-allows-three-character-username', { username: 'abc', inspect: async (_page, posts) => {
      assert.equal(posts[0].username, 'abc'); assert.equal(Object.hasOwn(posts[0], 'confirmPassword'), false);
      return { submittedUsername: posts[0].username, sendsConfirmPassword: false };
    } });
    await scenario('web-allows-spaces-in-username', { username: 'qa resident' });
    await scenario('web-blocks-short-password', { password: 'Ab1', expectedError: 'Min 8 characters' });
    await scenario('web-requires-special-character', { password: 'Abc12345', expectedError: 'Need at least one special character' });
    await scenario('web-email-fallback-still-displays-phone', { email: 'qa@example.invalid', channel: 'email', inspect: async (page) => {
      const text = await page.locator('body').innerText(); assert.ok(text.includes('0999***999')); assert.ok(!text.includes('qa***@example.invalid'));
      return { responseChannel: 'email', displayedDestination: '0999***999' };
    } });
    await scenario('web-does-not-normalize-country-code', { phone: '+639999999999', expectedError: 'Must be 09XXXXXXXXX (11 digits)', inspect: async (page) => ({ fieldValue: await page.locator('[name="contactNumber"]').inputValue() }) });
  } finally {
    fs.writeFileSync(path.join(__dirname, 'registration-browser-results.json'), JSON.stringify({ mode: 'Local production bundle, headless Chrome, synthetic intercepted API', results }, null, 2));
    await browser.close(); await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
