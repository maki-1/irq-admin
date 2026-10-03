// Contract audit: real senders, notification helpers and HTTP controllers;
// isolated database and provider doubles. No .env, real recipients or live sends.
// Exit 1 means at least one product contract failed; details are retained in JSON.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../server');
const mobile = process.env.MOBILE_BACKEND_DIR || 'D:/irequestd/backend';
const wr = createRequire(path.join(root, 'package.json'));
const mr = createRequire(path.join(mobile, 'package.json'));
const express = wr('express');
Object.assign(process.env, { JWT_SECRET: 'qa-only-session-secret', APPROVE_LINK_SECRET: 'qa-only-approval-secret', PORTAL_URL: 'https://portal.example.invalid', EMAIL_USER: 'sender@example.invalid', EMAIL_PASS: 'qa-only', UNISMS_API_KEY: 'qa-only', UNISMS_SENDER_ID: 'QA' });
const ids = Array.from({ length: 8 }, (_, i) => `${i + 1}`.repeat(8) + '-' + `${i + 1}`.repeat(4) + '-4' + `${i + 1}`.repeat(3) + '-8' + `${i + 1}`.repeat(3) + '-' + `${i + 1}`.repeat(12));
const [leaderId, residentId, requestId, otherResidentId, otherRequestId, captainId, legacyResidentId, legacyRequestId] = ids;
const clone = x => x == null ? x : structuredClone(x);
const results = [];
const diagnostics = [];
let state, calls, fault, barrier, base, server;
const settle = () => new Promise(resolve => setImmediate(resolve));
function matches(row, where = {}) {
  return !!row && Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(v => matches(row, v));
    if (key === 'AND') return value.every(v => matches(row, v));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('in' in value) return value.in.includes(row[key]);
      if ('equals' in value) return value.mode === 'insensitive' ? String(row[key]).toLowerCase() === String(value.equals).toLowerCase() : row[key] === value.equals;
      if ('contains' in value) return row[key] != null && String(row[key]).toLowerCase().includes(String(value.contains).toLowerCase());
    }
    return row[key] === value;
  });
}
function model(table) {
  const selected = (row, select) => row == null ? null : select ? Object.fromEntries(Object.keys(select).filter(k => select[k]).map(k => [k, clone(row[k])])) : clone(row);
  return {
    findUnique: async ({ where, select }) => selected(state[table].find(r => matches(r, where)), select),
    findFirst: async ({ where, select }) => {
      const row = selected(state[table].find(r => matches(r, where)), select);
      if (table === 'requests' && barrier) await barrier();
      return row;
    },
    findMany: async ({ where = {}, select } = {}) => state[table].filter(r => matches(r, where)).map(r => selected(r, select)),
    create: async ({ data }) => {
      if (fault === table || fault === 'all-delivery' && table === 'notifications') throw new Error('Injected ' + table + ' failure');
      const row = { id: crypto.randomUUID(), createdAt: new Date(), purokLeaderStatus: 'pending', status: 'Pending', ...clone(data) }; state[table].push(row); return clone(row);
    },
    update: async ({ where, data, select }) => {
      const row = state[table].find(r => matches(r, where)); if (!row) throw Object.assign(new Error('Not found'), { code: 'P2025' });
      Object.assign(row, clone(data)); return selected(row, select);
    },
    updateMany: async ({ where, data }) => { const rows = state[table].filter(r => matches(r, where)); rows.forEach(r => Object.assign(r, clone(data))); return { count: rows.length }; },
    deleteMany: async ({ where }) => { const old = state[table].length; state[table] = state[table].filter(r => !matches(r, where)); return { count: old - state[table].length }; },
  };
}
const db = { admin: model('admins'), verificationProfile: model('profiles'), request: model('requests'), notification: model('notifications'), auditTrail: model('audits'), documentPrice: model('prices') };
let transactionQueue = Promise.resolve();
db.$transaction = fn => {
  const result = transactionQueue.then(async () => { const saved = clone(state); try { return await fn(db); } catch (e) { state = saved; throw e; } });
  transactionQueue = result.catch(() => {}); return result;
};
function stub(file, exports) { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports }; }
for (const dir of [root, mobile]) stub(path.join(dir, 'lib/prisma.js'), db);
function providers(resolve, name) {
  stub(resolve.resolve('axios'), { post: async (url, data, config) => {
    calls.sms.push({ name, url, data: clone(data), config: clone(config) });
    if (fault === 'sms' || fault === 'all-delivery') throw Object.assign(new Error('Injected SMS failure'), { response: { status: 422, data: { errors: { sender_id: ['QA rejection'] } } } });
    return { data: { message: { reference_id: 'qa-message', status: 'pending' } } };
  } });
  stub(resolve.resolve('nodemailer'), { createTransport: config => ({ sendMail: async data => {
    calls.email.push({ name, data: clone(data), config: clone(config) });
    if (fault === 'email' || fault === 'all-delivery') throw new Error('Injected SMTP failure');
    return { messageId: 'qa-email', accepted: [data.to], rejected: [] };
  } }) });
}
providers(wr, 'web'); providers(mr, 'mobile');
const webSms = require(path.join(root, 'src/utils/sendSms'));
const webEmail = require(path.join(root, 'src/utils/sendEmail'));
const mobileSms = require(path.join(mobile, 'services/sms')).sendSms;
const mobileEmail = require(path.join(mobile, 'services/email')).sendEmail;
const notifiers = [
  { name: 'web', notify: require(path.join(root, 'lib/purokNotify')).notifyPurokLeader, sms: (to, message) => webSms({ to, message }), email: webEmail },
  { name: 'mobile', notify: require(path.join(mobile, 'lib/purokNotify')).notifyPurokLeader, sms: mobileSms, email: mobileEmail },
];
const links = require(path.join(root, 'lib/approveLink'));
stub(path.join(root, 'lib/purokFee.js'), { purokFeeCentavosForUser: async () => 2500 });
stub(path.join(root, 'src/config/cloudinary.js'), {});
stub(path.join(root, 'src/utils/generateORNumber.js'), async () => 'QA-OR');
stub(path.join(mobile, 'lib/orNumber.js'), { nextOrNumber: async () => 'QA-OR' });
// Authentication of resident creation routes is outside this notification audit.
stub(path.join(mobile, 'middleware/auth.js'), (req, _res, next) => { req.user = { id: residentId }; next(); });
// The kiosk fixture models an already-issued clearance; redemption stamps approved.
stub(path.join(root, 'lib/purokClearance.js'), {
  verifyClearance: async () => ({ ok: true, clearance: { id: 'qa-clearance', controlNo: 'QA-CODE', userId: residentId } }),
  redeemClearance: async (_id, requestIds) => { await db.request.updateMany({ where: { id: { in: requestIds } }, data: { purokLeaderStatus: 'approved', purokClearanceFee: 0 } }); return { ok: true }; },
});
const app = express(); app.use(express.json());
app.use('/api/purok-approve', require(path.join(root, 'src/routes/purokApprove.routes')));
const portalApprovals = require(path.join(root, 'src/controllers/purokLeader.controller'));
app.post('/portal/approve/:id', (req, _res, next) => { req.user = state.admins[0]; next(); }, portalApprovals.approveRequest);
app.post('/portal/reject/:id', (req, _res, next) => { req.user = state.admins[0]; next(); }, portalApprovals.rejectRequest);
app.use('/api/users', require(path.join(root, 'src/routes/user.routes')));
app.post('/web/bulk', (req, _res, next) => { req.resident = { id: residentId }; next(); }, require(path.join(root, 'src/controllers/resident.request.controller')).createBulk);
app.post('/web/payment-request', (req, _res, next) => { req.resident = { id: residentId }; next(); }, require(path.join(root, 'src/controllers/resident.payment.controller')).createSession);
app.post('/kiosk/requests', require(path.join(root, 'src/controllers/kiosk.controller')).submitRequests);
app.use('/mobile/requests', require(path.join(mobile, 'routes/requests')));
function reset() {
  fault = null; barrier = null; calls = { sms: [], email: [] };
  state = {
    admins: [
      { id: leaderId, role: 'Purok Leader', active: true, fullName: 'QA Leader', purok: 'Purok 10', sessionVersion: 2, contactNumber: '09999999999', email: 'login@example.invalid', notifyEmail: 'notify@example.invalid' },
      { id: captainId, role: 'Barangay Captain', active: true, fullName: 'QA Captain', sessionVersion: 0 },
    ],
    profiles: [{ userId: residentId, fullName: 'QA Resident', purok: 'Purok 10', address: 'Purok 10, Dologon' }, { userId: otherResidentId, fullName: 'Other Resident', purok: 'Purok 2', address: 'Purok 2' }],
    requests: [{ id: requestId, userId: residentId, documentType: 'Certificate of Residency', status: 'Pending', purokLeaderStatus: 'pending', channel: 'web', completedDocuments: [] }, { id: otherRequestId, userId: otherResidentId, documentType: 'Certificate of Residency', status: 'Pending', purokLeaderStatus: 'pending', channel: 'mobile', completedDocuments: [] }],
    notifications: [], audits: [], prices: [],
  };
  process.env.UNISMS_SENDER_ID = 'QA'; process.env.APPROVE_LINK_SECRET = 'qa-only-approval-secret';
}
async function check(name, fn) {
  reset(); const logs = []; const saved = { log: console.log, warn: console.warn, error: console.error };
  for (const key of Object.keys(saved)) console[key] = (...args) => logs.push(args.map(String).join(' '));
  try { const details = await fn(); await settle(); results.push({ name, passed: true, ...(details ? { details } : {}) }); }
  catch (e) { results.push({ name, passed: false, message: e.message, actual: e.actual, expected: e.expected }); }
  finally { Object.assign(console, saved); }
  console.log((results.at(-1).passed ? 'PASS ' : 'FAIL ') + name);
}
async function notify(n, extra = {}) {
  const result = await n.notify({ userId: residentId, documentTypes: ['Certificate of Residency'], sendSms: n.sms, sendEmail: n.email, ...extra }, db);
  await settle(); return result;
}
async function call(url, body, method = body ? 'POST' : 'GET', token) {
  const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
const token = () => links.tokenParams(leaderId, state.admins[0].sessionVersion);
const pending = p => call('/api/purok-approve/pending?' + new URLSearchParams(p || token()));
const act = (action, extra = {}) => call('/api/purok-approve/action', { ...token(), requestId, action, ...extra });
async function main() {
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const n of notifiers) {
      await check(n.name + ': routes both channels to saved contact and Notify Email', async () => {
        const r = await notify(n); assert.equal(r.notified, true); assert.equal(state.notifications.length, 1);
        assert.equal(calls.sms[0].data.recipient, '+639999999999'); assert.equal(calls.email[0].data.to, 'notify@example.invalid');
        assert.match(calls.sms[0].data.content, /QA Resident.*Purok 10/); assert.doesNotMatch(calls.sms[0].data.content, /https?:/);
      });
      await check(n.name + ': skips missing resident purok without sending', async () => { state.profiles[0].purok = null; assert.equal((await notify(n)).reason, 'no_purok'); assert.equal(calls.sms.length + calls.email.length, 0); });
      await check(n.name + ': skips missing leader without sending', async () => { state.admins.shift(); assert.equal((await notify(n)).reason, 'no_leader'); assert.equal(calls.sms.length + calls.email.length, 0); });
      await check(n.name + ': disabled leader receives no notifications', async () => { state.admins[0].active = false; await notify(n); assert.equal(calls.sms.length + calls.email.length + state.notifications.length, 0); });
      await check(n.name + ': login email is not used when Notify Email is blank', async () => { state.admins[0].notifyEmail = null; await notify(n); assert.equal(calls.email.length, 0); assert.equal(calls.sms.length, 1); });
      await check(n.name + ': SMS-only and email-only contacts work', async () => { state.admins[0].contactNumber = null; await notify(n); assert.equal(calls.sms.length, 0); assert.equal(calls.email.length, 1); });
      await check(n.name + ': in-app failure does not block external channels', async () => { fault = 'notifications'; await notify(n); assert.equal(calls.sms.length, 1); assert.equal(calls.email.length, 1); });
      await check(n.name + ': SMS rejection does not block email', async () => { fault = 'sms'; await notify(n); assert.equal(calls.email.length, 1); });
      await check(n.name + ': SMTP rejection does not block SMS', async () => { fault = 'email'; await notify(n); assert.equal(calls.sms.length, 1); });
      await check(n.name + ': email contains a valid current-version approval link', async () => { await notify(n); const href = calls.email[0].data.html.match(/href="([^"]+)"/)?.[1]; assert.ok(href, 'No approval button/link in email'); const url = new URL(href.replace(/&amp;/g, '&')); assert.equal(url.origin, 'https://portal.example.invalid'); assert.equal(links.verify(Object.fromEntries(url.searchParams)), leaderId); });
      await check(n.name + ': provider request uses E.164, sender ID and authentication', async () => { await n.sms('+63 999 999 9999', 'QA test'); assert.equal(calls.sms[0].data.recipient, '+639999999999'); assert.equal(calls.sms[0].data.sender_id, 'QA'); assert.ok(calls.sms[0].config.auth || calls.sms[0].config.headers.Authorization); });
      await check(n.name + ': SMS request has a bounded timeout', async () => { await n.sms('09999999999', 'QA test'); assert.ok(calls.sms[0].config.timeout > 0, 'No explicit SMS request timeout'); });
      await check(n.name + ': provider failure is returned by sender', async () => { fault = 'sms'; await assert.rejects(n.sms('09999999999', 'QA test')); fault = 'email'; await assert.rejects(n.email({ to: 'qa@example.invalid', subject: 'QA', html: '<p>QA</p>' })); });
      await check(n.name + ': missing sender ID blocks sending locally', async () => { delete process.env.UNISMS_SENDER_ID; await assert.rejects(n.sms('09999999999', 'QA test')); assert.equal(calls.sms.length, 0); });
      await check(n.name + ': email escapes resident-supplied markup', async () => { state.profiles[0].fullName = '<a href="https://untrusted.example.invalid">QA Resident</a>'; await notify(n); assert.doesNotMatch(calls.email[0].data.html, /<a href="https:\/\/untrusted/); });
      await check(n.name + ': duplicate purok leaders do not silently lose reachable email', async () => { state.admins.unshift({ ...state.admins[0], id: crypto.randomUUID(), notifyEmail: null }); await notify(n); assert.equal(calls.email.length, 1, 'The first matching leader has no Notify Email; the reachable second leader is ignored'); });
      await check(n.name + ': all-channel failures are not reported as notified', async () => { fault = 'all-delivery'; const r = await notify(n); assert.equal(r.notified, false, 'Returns notified:true even when in-app, SMS and email all fail'); });
    }
    await check('web: no signing secret falls back to a normal sign-in link', async () => { delete process.env.APPROVE_LINK_SECRET; await notify(notifiers[0]); assert.doesNotMatch(calls.email[0].data.html, /purok-approve\?/); assert.match(calls.email[0].data.html, /href="https:\/\/portal.example.invalid\/login"/); assert.match(calls.email[0].data.html, /Sign in to review/); });
    await check('approval: valid link lists only pending requests in assigned purok', async () => { const r = await pending(); assert.equal(r.status, 200); assert.deepEqual(r.body.requests.map(r => r.id), [requestId]); });
    await check('approval: approves request and records fee plus audit', async () => { const r = await act('approve'); assert.equal(r.status, 200); assert.equal(r.body.request.purokLeaderStatus, 'approved'); assert.equal(r.body.request.purokClearanceFee, 25); assert.equal(state.audits.length, 1); assert.equal((await pending()).body.requests.length, 0); });
    await check('approval: rejects request and synchronizes resident status', async () => { const r = await act('reject'); assert.equal(r.status, 200); assert.equal(r.body.request.status, 'Rejected'); assert.equal(r.body.request.purokLeaderStatus, 'rejected'); });
    await check('approval: repeated action returns conflict', async () => { assert.equal((await act('approve')).status, 200); assert.equal((await act('reject')).status, 409); });
    await check('approval: another purok request cannot be approved', async () => { assert.equal((await act('approve', { requestId: otherRequestId })).status, 404); assert.equal(state.requests[1].purokLeaderStatus, 'pending'); });
    await check('approval: deactivated leader link is rejected', async () => { state.admins[0].active = false; assert.equal((await pending()).status, 401); assert.equal((await act('approve')).status, 401); });
    await check('approval: changed session version invalidates old link', async () => { const old = token(); state.admins[0].sessionVersion++; assert.equal((await pending(old)).status, 401); assert.equal((await act('approve', old)).status, 401); });
    await check('approval: wrong staff role is rejected', async () => { state.admins[0].role = 'Secretary'; assert.equal((await pending()).status, 401); });
    await check('approval: expired, tampered and incomplete links are rejected', async () => {
      for (const patch of [{ exp: Date.now() - 1 }, { sig: '0'.repeat(64) }, { v: '99' }, { lid: captainId }, { v: '' }]) { assert.equal((await pending({ ...token(), ...patch })).status, 401); assert.equal((await act('approve', patch)).status, 401); }
    });
    await check('approval: malformed request and action are rejected', async () => { assert.equal((await act('unknown')).status, 400); assert.equal((await act('approve', { requestId: 'not-uuid' })).status, 404); });
    await check('approval: Purok 1 cannot read legacy Purok 10 addresses', async () => { state.admins[0].purok = 'Purok 1'; state.profiles[0].purok = null; assert.equal((await pending()).body.requests.length, 0); });
    await check('approval: Purok 1 cannot approve legacy Purok 10 request', async () => { state.admins[0].purok = 'Purok 1'; state.profiles[0].purok = null; assert.equal((await act('approve')).status, 404); });
    await check('approval: audit failure does not leave a committed decision behind a 500', async () => { fault = 'audits'; const r = await act('approve'); assert.equal(r.status, 500); assert.equal(state.requests[0].purokLeaderStatus, 'pending'); });
    await check('approval: simultaneous approve and reject have one winner', async () => {
      let release; const gate = new Promise(resolve => { release = resolve; }); let readers = 0;
      barrier = async () => { if (++readers === 2) release(); await gate; };
      const pair = await Promise.all([act('approve'), act('reject')]);
      assert.deepEqual(pair.map(r => r.status).sort(), [200, 409]);
      assert.equal(state.requests[0].purokLeaderStatus, pair[0].status === 200 ? 'approved' : 'rejected');
      assert.equal(state.audits.length, 1);
    });
    await check('approval: portal action cannot overwrite a concurrent email decision', async () => {
      let release; const gate = new Promise(resolve => { release = resolve; }); let readers = 0;
      barrier = async () => { if (++readers === 2) release(); await gate; };
      const pair = await Promise.all([call('/portal/approve/' + requestId, {}), act('reject')]);
      assert.deepEqual(pair.map(r => r.status).sort(), [200, 409]);
      assert.equal(state.requests[0].purokLeaderStatus, pair[0].status === 200 ? 'approved' : 'rejected');
      assert.equal(state.audits.length, 1);
    });
    await check('approval: portal rejection cannot overwrite a concurrent email approval', async () => {
      let release; const gate = new Promise(resolve => { release = resolve; }); let readers = 0;
      barrier = async () => { if (++readers === 2) release(); await gate; };
      const pair = await Promise.all([call('/portal/reject/' + requestId, {}), act('approve')]);
      assert.deepEqual(pair.map(r => r.status).sort(), [200, 409]);
      assert.equal(state.requests[0].purokLeaderStatus, pair[0].status === 200 ? 'rejected' : 'approved');
      assert.equal(state.audits.length, 1);
    });
    for (const action of ['approve', 'reject']) await check('approval: portal ' + action + ' rolls back when its audit fails', async () => {
      fault = 'audits';
      const r = await call('/portal/' + action + '/' + requestId, {});
      assert.equal(r.status, 500); assert.equal(state.requests[0].purokLeaderStatus, 'pending'); assert.equal(state.audits.length, 0);
    });
    for (const [name, url, body] of [
      ['web bulk', '/web/bulk', { documents: [{ type: 'Certificate of Residency', purpose: 'Employment' }, { type: 'Certificate of Indigency', purpose: 'Scholarship' }] }],
      ['web payment submission', '/web/payment-request', { documents: [{ type: 'Certificate of Residency', purpose: 'Employment' }] }],
      ['mobile single', '/mobile/requests', { documentType: 'Certificate of Residency', purpose: 'Employment', deliveryMethod: 'Pick up at Barangay Office' }],
      ['mobile bulk', '/mobile/requests/bulk', { items: [{ documentType: 'Certificate of Residency', purpose: 'Employment' }, { documentType: 'Certificate of Indigency', purpose: 'Scholarship' }] }],
    ]) await check('trigger: ' + name + ' dispatches one SMS and email per submission', async () => { const r = await call(url, body); assert.ok([200, 201].includes(r.status), JSON.stringify(r.body)); await settle(); assert.equal(calls.sms.length, 1); assert.equal(calls.email.length, 1); });
    await check('trigger: approved kiosk clearance does not request approval again', async () => {
      const r = await call('/kiosk/requests', { controlNo: 'QA-CODE', birthday: '2000-01-01', surname: 'Resident', items: [{ documentType: 'Certificate of Residency', purpose: 'Employment' }] });
      assert.equal(r.status, 201); assert.equal(r.body.requests[0].purokLeaderStatus, 'approved'); await settle();
      assert.ok(calls.sms.every(r => !/needs your purok clearance approval/.test(r.data.content)), 'Already-approved kiosk request sends another approval-needed message');
    });
    const policy = require(path.join(root, 'lib/accountLifecycle'));
    await check('staff: Captain contact edit is used by next notification', async () => {
      const r = await call('/api/users/' + leaderId, { contactNumber: '+63 977 777 7777', notifyEmail: ' updated@example.invalid ' }, 'PATCH', policy.signToken(state.admins[1], 'staff'));
      assert.equal(r.status, 200); await notify(notifiers[0]); assert.equal(calls.sms[0].data.recipient, '+639777777777'); assert.equal(calls.email[0].data.to, 'updated@example.invalid');
    });
    await check('staff: non-Captain cannot edit leader contact', async () => { assert.equal((await call('/api/users/' + leaderId, { contactNumber: '09999999998' }, 'PATCH', policy.signToken(state.admins[0], 'staff'))).status, 403); });
    await check('staff: malformed notification contacts are rejected', async () => { assert.equal((await call('/api/users/' + leaderId, { contactNumber: '123', notifyEmail: 'not-an-email' }, 'PATCH', policy.signToken(state.admins[1], 'staff'))).status, 400); });
  } finally { await new Promise(resolve => server.close(resolve)); }
  const report = { testedAt: new Date().toISOString(), liveSends: 0, realDatabaseWrites: 0, scope: 'Provider and Prisma doubles, real sender/notification/controller modules, local HTTP requests; kiosk clearance verification and fee lookup stubbed.', total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results };
  fs.writeFileSync(path.join(__dirname, 'approval-notification-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed }));
  process.exitCode = report.failed ? 1 : 0;
}
main().catch(e => { console.error(e); process.exitCode = 2; server?.close(); });
