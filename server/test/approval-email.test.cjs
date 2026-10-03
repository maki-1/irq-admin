// Isolated provider and Prisma doubles: no .env loading or live messages.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let config, outcome, sent, closed, verified;
function stub(file, exports) { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub('nodemailer', { createTransport: options => {
  config = options;
  return {
    sendMail: async message => { sent.push(message); if (outcome instanceof Error) throw outcome; return outcome; },
    verify: async () => { verified++; if (outcome instanceof Error) throw outcome; return true; },
    close: () => { closed++; },
  };
} });
stub('../lib/prisma', {});
const { sendEmail, createTransporter, verifyEmailConnection } = require('../lib/emailDelivery');
const { portalUrl, buildLink, verify } = require('../lib/approveLink');
const { notificationContact } = require('../lib/notificationContact');
const { belongsToPurok } = require('../lib/purokScope');
const { notifyPurokLeader } = require('../lib/purokNotify');
const lid = '11111111-1111-4111-8111-111111111111';
const otherLid = '22222222-2222-4222-8222-222222222222';
const mail = { to: 'qa@example.invalid', subject: 'QA', html: '<p>QA</p>', text: 'QA' };
beforeEach(() => {
  Object.assign(process.env, { EMAIL_USER: ' sender@example.invalid ', EMAIL_PASS: 'abcd efgh ijkl mnop', APPROVE_LINK_SECRET: 'qa-link-secret', PORTAL_URL: 'https://portal.example.invalid', NODE_ENV: 'test' });
  outcome = { messageId: 'qa-id', accepted: ['qa@example.invalid'], rejected: [] }; sent = []; closed = 0; verified = 0;
});

test('both backends ship identical approval, contact and email modules', { skip: !process.env.MOBILE_BACKEND_DIR }, () => {
  for (const name of ['emailDelivery.js', 'approveLink.js', 'purokNotify.js', 'notificationContact.js']) {
    const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    assert.equal(read(path.join(__dirname, '../lib', name)), read(path.join(process.env.MOBILE_BACKEND_DIR, 'lib', name)), name);
  }
});
test('email sender normalizes Gmail app-password formatting and bounds connection phases', async () => {
  const result = await sendEmail(mail);
  assert.equal(config.auth.user, 'sender@example.invalid'); assert.equal(config.auth.pass, 'abcdefghijklmnop');
  assert.equal(config.secure, true); assert.equal(config.port, 465);
  for (const key of ['connectionTimeout', 'greetingTimeout', 'socketTimeout']) assert.ok(config[key] > 0 && config[key] <= 15000);
  assert.deepEqual(sent[0].from, { name: 'iRequestDologon', address: 'sender@example.invalid' });
  assert.equal(sent[0].text, 'QA'); assert.equal(result.messageId, 'qa-id'); assert.equal(closed, 1);
});
test('missing email configuration is rejected before transport creation', () => {
  assert.throws(() => createTransporter({ EMAIL_USER: 'qa@example.invalid' }), { code: 'EMAIL_CONFIG' });
});
test('SMTP authentication errors are actionable without leaking provider diagnostics', async () => {
  outcome = Object.assign(new Error('private-provider-diagnostic'), { code: 'EAUTH', responseCode: 535 });
  await assert.rejects(sendEmail(mail), error => error.code === 'EAUTH' && error.responseCode === 535 && /app password/.test(error.message) && !error.message.includes('private-provider-diagnostic'));
  assert.equal(closed, 1);
});
test('SMTP recipient rejection cannot be reported as accepted', async () => {
  outcome = { accepted: [], rejected: [mail.to] }; await assert.rejects(sendEmail(mail), { code: 'EMAIL_REJECTED' });
  outcome = { accepted: ['other@example.invalid'], rejected: [mail.to] }; await assert.rejects(sendEmail(mail), { code: 'EMAIL_REJECTED' });
});
test('SMTP verification authenticates without submitting a message', async () => {
  assert.equal(await verifyEmailConnection(), true); assert.equal(verified, 1); assert.equal(sent.length, 0); assert.equal(closed, 1);
});
test('production approval URLs reject missing, local, insecure and malformed origins', () => {
  for (const value of ['', 'http://portal.example.invalid', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'javascript:alert(1)', 'https://user:pass@portal.example.invalid', 'https://portal.example.invalid/resident', 'https://portal.example.invalid/?next=x']) {
    assert.equal(portalUrl({ NODE_ENV: 'production', PORTAL_URL: value, CLIENT_URL: 'https://resident.example.invalid' }), null, value);
  }
  assert.equal(portalUrl({ NODE_ENV: 'production', PORTAL_URL: ' https://portal.example.invalid/ ' }), 'https://portal.example.invalid');
});
test('links bind account version and cannot be issued with incomplete signing configuration', () => {
  const url = new URL(buildLink(process.env.PORTAL_URL, lid, 4)); const params = Object.fromEntries(url.searchParams);
  assert.equal(verify(params), lid); assert.equal(verify({ ...params, v: 5 }), null);
  assert.equal(buildLink(process.env.PORTAL_URL, lid), null);
  delete process.env.APPROVE_LINK_SECRET; assert.equal(buildLink(process.env.PORTAL_URL, lid, 4), null);
});
test('legacy purok matching admits exact addresses and rejects prefix collisions and ambiguous addresses', () => {
  assert.equal(belongsToPurok({ purok: null, address: 'Purok 1, Dologon' }, 'Purok 1'), true);
  assert.equal(belongsToPurok({ purok: null, address: 'Purok 10, Dologon' }, 'Purok 1'), false);
  assert.equal(belongsToPurok({ purok: null, address: 'Purok 1 near Purok 10' }, 'Purok 1'), false);
  assert.equal(belongsToPurok({ purok: 'Purok 2', address: 'Purok 1' }, 'Purok 1'), false);
  assert.equal(belongsToPurok({ purok: null, address: 'Purok 1' }, ''), false);
});
test('staff contacts normalize, can be cleared, and reject malformed nonempty input', () => {
  assert.deepEqual(notificationContact({ contactNumber: '+63 977 777 7777', notifyEmail: ' QA@Example.invalid ' }).data, { contactNumber: '09777777777', notifyEmail: 'qa@example.invalid' });
  assert.deepEqual(notificationContact({ contactNumber: '', notifyEmail: null }).data, { contactNumber: null, notifyEmail: null });
  for (const contactNumber of ['123', 'garbage09999999999', '099999999999', '00000000000']) assert.ok(notificationContact({ contactNumber }).error);
  assert.ok(notificationContact({ notifyEmail: 'not-an-email' }).error);
});
function client(leaders) {
  return {
    admin: { findMany: async args => { assert.equal(args.where.active, true); assert.equal(args.where.role, 'Purok Leader'); return leaders; } },
    verificationProfile: { findUnique: async () => ({ fullName: 'QA <Resident>', purok: 'Purok 10' }) },
    notification: { create: async () => ({ id: 'qa-notification' }) },
  };
}
test('all active assigned leaders receive emails with their own signed links', async () => {
  const messages = [];
  const leaders = [{ id: lid, sessionVersion: 1, fullName: 'First', notifyEmail: 'first@example.invalid' }, { id: otherLid, sessionVersion: 3, fullName: 'Second', notifyEmail: 'second@example.invalid' }];
  const result = await notifyPurokLeader({ userId: 'qa', documentTypes: ['Certificate'], sendEmail: async message => { messages.push(message); return { messageId: 'qa' }; } }, client(leaders));
  assert.equal(messages.length, 2); assert.equal(result.deliveries.length, 2);
  for (let i = 0; i < messages.length; i++) {
    const url = new URL(messages[i].html.match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&'));
    assert.equal(verify(Object.fromEntries(url.searchParams)), leaders[i].id);
    assert.equal(url.searchParams.get('v'), String(leaders[i].sessionVersion));
    assert.equal(messages[i].to, leaders[i].notifyEmail); assert.match(messages[i].html, /QA &lt;Resident&gt;/);
    assert.equal(result.deliveries[i].email.status, 'accepted');
  }
});
test('a synchronous SMS failure does not prevent an approval email', async () => {
  let emails = 0;
  const result = await notifyPurokLeader({ userId: 'qa', documentTypes: ['Certificate'], sendSms: () => { throw new Error('fixture'); }, sendEmail: async () => { emails++; return { messageId: 'qa' }; } }, client([{ id: lid, sessionVersion: 1, contactNumber: '09999999999', notifyEmail: 'qa@example.invalid' }]));
  assert.equal(emails, 1); assert.equal(result.deliveries[0].sms.status, 'failed'); assert.equal(result.deliveries[0].email.status, 'accepted');
});
test('the notification outcome waits for provider acceptance and preserves its message ID', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; }); let finished = false;
  const work = notifyPurokLeader({ userId: 'qa', sendEmail: async () => { await gate; return { messageId: 'provider-id' }; } }, client([{ id: lid, sessionVersion: 1, notifyEmail: 'qa@example.invalid' }])).then(result => { finished = true; return result; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(finished, false);
  release(); const result = await work; assert.equal(result.deliveries[0].email.reference, 'provider-id');
});
