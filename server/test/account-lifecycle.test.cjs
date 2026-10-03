// Real Express handlers and middleware; isolated DB and delivery doubles.
// Never loads .env or contacts a deployed service. Set MOBILE_BACKEND_DIR to
// include cross-service tests against the sibling checkout.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const root = path.resolve(__dirname, '..');
const mobile = process.env.MOBILE_BACKEND_DIR && path.resolve(process.env.MOBILE_BACKEND_DIR);
process.env.JWT_SECRET = 'test-only-account-lifecycle-secret';
process.env.APPROVE_LINK_SECRET = 'test-only-approval-link-secret';
const policy = require('../lib/accountLifecycle');
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
const password = 'Initial-password-123';
const newPassword = 'Replacement-password-456';
let residents, admins, otps, deliveries, server, base;
const copy = (x) => x == null ? x : structuredClone(x);
function matches(row, where = {}) {
  return row && Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some((item) => matches(row, item));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('gt' in value) return row[key] > value.gt;
      if ('in' in value) return value.in.includes(row[key]);
    }
    return row[key] === value;
  });
}
function model(rows) {
  const result = (row, select) => !row ? null : select
    ? Object.fromEntries(Object.keys(select).map((key) => [key, copy(row[key])])) : copy(row);
  const apply = (row, data) => Object.entries(data).forEach(([key, value]) => {
    row[key] = value && typeof value === 'object' && 'increment' in value ? row[key] + value.increment : copy(value);
  });
  return {
    findUnique: async ({ where, select }) => result(rows().find((r) => matches(r, where)), select),
    findFirst: async ({ where, select }) => result(rows().find((r) => matches(r, where)), select),
    findMany: async ({ where } = {}) => copy(rows().filter((r) => matches(r, where))),
    count: async () => rows().length,
    update: async ({ where, data, select }) => {
      const row = rows().find((r) => matches(r, where));
      if (!row) throw Object.assign(new Error('Record changed'), { code: 'P2025' });
      apply(row, data); return result(row, select);
    },
    updateMany: async ({ where, data }) => {
      const found = rows().filter((r) => matches(r, where));
      found.forEach((r) => apply(r, data)); return { count: found.length };
    },
    deleteMany: async ({ where }) => {
      let count = 0;
      for (let i = rows().length - 1; i >= 0; i--) if (matches(rows()[i], where)) { rows().splice(i, 1); count++; }
      return { count };
    },
    create: async ({ data }) => { const row = { id: ids[2], used: false, ...copy(data) }; rows().push(row); return copy(row); },
  };
}
const db = {
  user: model(() => residents), admin: model(() => admins), otpCode: model(() => otps),
  verificationProfile: { findUnique: async () => ({ status: 'approved' }), findMany: async () => [] },
  request: { findMany: async () => [] },
};
let transactionQueue = Promise.resolve();
db.$transaction = (action) => {
  const work = transactionQueue.then(() => typeof action === 'function' ? action(db) : Promise.all(action));
  transactionQueue = work.catch(() => {});
  return work;
};
function stub(file, exports) {
  const id = require.resolve(file);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub(path.join(root, 'lib/prisma.js'), db);
stub(path.join(root, 'src/config/cloudinary.js'), {});
stub(path.join(root, 'src/utils/sendSms.js'), async () => { deliveries++; });
stub(path.join(root, 'src/utils/sendEmail.js'), async () => { deliveries++; });
stub(path.join(root, 'src/utils/auditLog.js'), async () => {});
const { protect } = require('../src/middleware/auth');
const { residentProtect } = require('../src/middleware/residentAuth');
const app = express();
app.use(express.json());
app.use('/web/auth', require('../src/routes/auth.routes'));
app.use('/web/users', require('../src/routes/user.routes'));
app.get('/web/resident', residentProtect, (req, res) => res.json({ id: req.resident.id }));
app.get('/web/staff', protect, (req, res) => res.json({ role: req.user.role }));
const approvals = require('../src/controllers/purokApprove.controller');
app.get('/web/approvals', approvals.getPending);
const backends = ['web'];
if (mobile) {
  stub(path.join(mobile, 'lib/prisma.js'), db);
  stub(path.join(mobile, 'services/sms.js'), { sendOtp: async () => { deliveries++; }, sendPasswordResetOtp: async () => { deliveries++; } });
  stub(path.join(mobile, 'services/email.js'), { sendOtpEmail: async () => { deliveries++; } });
  stub(path.join(mobile, 'config/cloudinary.js'), { uploadAvatar: { single: () => (_req, _res, next) => next() } });
  app.use('/mobile/auth', require(path.join(mobile, 'routes/auth')));
  app.use('/mobile/admin', require(path.join(mobile, 'routes/admin')));
  app.get('/mobile/resident', require(path.join(mobile, 'middleware/auth')), (req, res) => res.json({ id: req.user.id }));
  app.get('/mobile/staff', require(path.join(mobile, 'middleware/adminAuth')), (req, res) => res.json({ role: req.admin.role }));
  backends.push('mobile');
}
async function call(url, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + url, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const post = (url, body, token) => call(url, { method: 'POST', body, token });
const residentToken = () => policy.signToken(residents[0], 'resident');
const staffToken = (i = 0) => policy.signToken(admins[i], 'staff');
const staffLogin = (backend) => backend === 'web' ? '/web/auth/login' : '/mobile/admin/login';
async function assertRevoked(token, kind = 'resident') {
  for (const backend of backends) {
    const res = await call(`/${backend}/${kind}`, { token });
    assert.equal(res.status, 401, JSON.stringify(res));
    assert.equal(res.body.code, 'SESSION_REVOKED');
  }
}
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); });
beforeEach(() => {
  const hash = bcrypt.hashSync(password, 4);
  residents = [{ id: ids[0], username: 'qa-resident', password: hash, contactNumber: '09999999999', active: true, deletedAt: null, sessionVersion: 0, contactVerified: true, isVerified: true, otp: null, otpAttempts: 0, resetToken: null, resetTokenExpires: null }];
  admins = [
    { id: ids[1], email: 'qa@example.invalid', fullName: 'QA staff', password: hash, role: 'Purok Leader', purok: 'Purok 1', active: true, sessionVersion: 0 },
    { id: ids[2], email: 'captain@example.invalid', fullName: 'QA captain', password: hash, role: 'Barangay Captain', active: true, sessionVersion: 0 },
  ];
  otps = []; deliveries = 0;
});

test('vendored mobile policy is identical to the canonical source', { skip: !mobile }, () => {
  const source = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(source(path.join(mobile, 'lib/accountLifecycle.js')), source(path.join(root, 'lib/accountLifecycle.js')));
});
for (const backend of backends) {
  test(`${backend}: active resident and staff can log in and use both services`, async () => {
    for (const kind of ['resident', 'staff']) {
      const res = await post(kind === 'resident' ? `/${backend}/auth/login` : staffLogin(backend), kind === 'resident'
        ? { username: residents[0].username, password } : { email: admins[0].email, password });
      assert.equal(res.status, 200, JSON.stringify(res));
      for (const target of backends) assert.equal((await call(`/${target}/${kind}`, { token: res.body.token })).status, 200);
    }
  });
  test(`${backend}: disabled resident and staff cannot log in`, async () => {
    residents[0].active = false; admins[0].active = false;
    for (const [url, body] of [[`/${backend}/auth/login`, { username: residents[0].username, password }], [staffLogin(backend), { email: admins[0].email, password }]]) {
      const res = await post(url, body); assert.equal(res.status, 403); assert.equal(res.body.code, 'ACCOUNT_DISABLED'); assert.ok(!res.body.token);
    }
    assert.equal(deliveries, 0);
  });
  test(`${backend}: existing sessions and /me lose access immediately on deactivation`, async () => {
    const rt = residentToken(), st = staffToken();
    residents[0].active = false; admins[0].active = false;
    for (const [url, token] of [[`/${backend}/resident`, rt], [`/${backend}/auth/me`, rt], [`/${backend}/staff`, st]]) {
      const res = await call(url, { token }); assert.equal(res.status, 403); assert.equal(res.body.code, 'ACCOUNT_DISABLED');
    }
  });
  test(`${backend}: soft deletion blocks login and existing sessions even with active=true`, async () => {
    const token = residentToken(); residents[0].deletedAt = new Date();
    assert.equal((await post(`/${backend}/auth/login`, { username: residents[0].username, password })).status, 403);
    assert.equal((await call(`/${backend}/auth/me`, { token })).status, 403);
  });
  test(`${backend}: reset, staff, legacy and unsigned tokens cannot enter resident routes`, async () => {
    const tokens = [policy.signToken(residents[0], 'resident', 'reset'), staffToken(), ids[0], jwt.sign({ id: ids[0], role: 'resident' }, process.env.JWT_SECRET)];
    for (const token of tokens) assert.equal((await call(`/${backend}/resident`, { token })).status, 401);
    assert.equal((await call(`/${backend}/staff`, { token: residentToken() })).status, 401);
  });
  test(`${backend}: staff role comes from the current account`, async () => {
    const token = staffToken(); admins[0].role = 'Collector';
    assert.equal((await call(`/${backend}/staff`, { token })).body.role, 'Collector');
  });
  test(`${backend}: disabled accounts cannot verify or resend registration/reset OTP`, async () => {
    residents[0].active = false;
    for (const type of ['register', 'reset']) {
      const res = await post(`/${backend}/auth/verify-otp`, { userId: ids[0], type, code: '123456', otp: '123456' });
      assert.equal(res.status, 403); assert.ok(!res.body.token && !res.body.resetToken);
      assert.equal((await post(`/${backend}/auth/resend-otp`, { userId: ids[0], type })).status, 403);
    }
    await post(`/${backend}/auth/forgot-password`, { contactNumber: residents[0].contactNumber, identifier: residents[0].contactNumber });
    assert.equal(deliveries, 0); assert.equal(otps.length, 0);
  });
  test(`${backend}: password change revokes both devices and both recovery stores`, async () => {
    const token = residentToken();
    residents[0].resetToken = 'old-web-reset'; residents[0].otp = '123456';
    otps.push({ id: ids[1], userId: ids[0], used: false });
    const res = await call(`/${backend}/auth/change-password`, { method: backend === 'web' ? 'POST' : 'PUT', token, body: { currentPassword: password, newPassword, confirmPassword: newPassword } });
    assert.equal(res.status, 200, JSON.stringify(res)); assert.equal(res.body.sessionsRevoked, true);
    assert.equal(residents[0].sessionVersion, 1); assert.equal(residents[0].resetToken, null); assert.equal(residents[0].otp, null); assert.equal(otps.length, 0);
    await assertRevoked(token);
    assert.equal((await post(`/${backend}/auth/login`, { username: residents[0].username, password: newPassword })).status, 200);
  });
  test(`${backend}: wrong current password leaves sessions valid`, async () => {
    const token = residentToken();
    const res = await call(`/${backend}/auth/change-password`, { method: backend === 'web' ? 'POST' : 'PUT', token, body: { currentPassword: 'wrong', newPassword, confirmPassword: newPassword } });
    assert.ok([400, 401].includes(res.status)); assert.equal(residents[0].sessionVersion, 0);
    assert.equal((await call(`/${backend}/resident`, { token })).status, 200);
  });
  test(`${backend}: reset is single use under concurrent requests and revokes existing access`, async () => {
    const access = residentToken();
    const resetToken = backend === 'web' ? 'web-reset-fixture' : policy.signToken(residents[0], 'resident', 'reset');
    residents[0].resetToken = resetToken; residents[0].resetTokenExpires = new Date(Date.now() + 60000);
    const body = { token: resetToken, resetToken, newPassword, confirmPassword: newPassword };
    const results = await Promise.all([post(`/${backend}/auth/reset-password`, body), post(`/${backend}/auth/reset-password`, body)]);
    assert.equal(results.filter((r) => r.status === 200).length, 1, JSON.stringify(results));
    assert.ok((await post(`/${backend}/auth/reset-password`, body)).status >= 400);
    await assertRevoked(access);
  });
  test(`${backend}: deactivated account cannot redeem an outstanding reset token`, async () => {
    const resetToken = backend === 'web' ? 'reset-fixture' : policy.signToken(residents[0], 'resident', 'reset');
    Object.assign(residents[0], { active: false, resetToken, resetTokenExpires: new Date(Date.now() + 60000) });
    const res = await post(`/${backend}/auth/reset-password`, { token: resetToken, resetToken, newPassword, confirmPassword: newPassword });
    assert.ok([400, 401, 403].includes(res.status)); assert.equal(residents[0].sessionVersion, 0);
  });
  test(`${backend}: valid registration OTP issues a scoped token and cannot be reused`, async () => {
    Object.assign(residents[0], { contactVerified: false, otp: '123456', otpType: 'verification', otpExpires: new Date(Date.now() + 60000) });
    otps.push({ id: ids[1], userId: ids[0], type: 'register', used: false, expiresAt: new Date(Date.now() + 60000), code: bcrypt.hashSync('123456', 4) });
    const body = { userId: ids[0], type: 'register', otp: '123456', code: '123456' };
    const res = await post(`/${backend}/auth/verify-otp`, body);
    assert.equal(res.status, 200, JSON.stringify(res)); assert.equal(policy.verifyToken(res.body.token, 'resident').sessionVersion, 0);
    assert.ok((await post(`/${backend}/auth/verify-otp`, body)).status >= 400);
  });
  test(`${backend}: reset OTP grants recovery only and completes with all sessions revoked`, async () => {
    const access = residentToken();
    Object.assign(residents[0], { otp: '123456', otpType: 'reset', otpExpires: new Date(Date.now() + 60000) });
    otps.push({ id: ids[1], userId: ids[0], type: 'reset', used: false, expiresAt: new Date(Date.now() + 60000), code: bcrypt.hashSync('123456', 4) });
    const verified = await post(`/${backend}/auth/verify-otp`, { userId: ids[0], type: 'reset', otp: '123456', code: '123456' });
    assert.equal(verified.status, 200, JSON.stringify(verified));
    assert.ok(verified.body.resetToken); assert.ok(!verified.body.token);
    assert.equal((await call(`/${backend}/resident`, { token: verified.body.resetToken })).status, 401);
    const resetToken = verified.body.resetToken;
    const reset = await post(`/${backend}/auth/reset-password`, { token: resetToken, resetToken, newPassword, confirmPassword: newPassword });
    assert.equal(reset.status, 200, JSON.stringify(reset)); await assertRevoked(access);
  });
}
test('web resident /me and staff /me both reload account activity', async () => {
  const token = staffToken(); admins[0].active = false;
  assert.equal((await call('/web/auth/me', { token })).status, 403);
});
test('staff deactivation then reactivation never revives old sessions', async () => {
  const token = staffToken(), captain = staffToken(1);
  for (const active of [false, true]) {
    const res = await call(`/web/users/${ids[1]}/active`, { method: 'PATCH', token: captain, body: { active } });
    assert.equal(res.status, 200, JSON.stringify(res));
  }
  await assertRevoked(token, 'staff');
  assert.equal((await post('/web/auth/login', { email: admins[0].email, password })).status, 200);
});
test('staff password change revokes existing staff sessions across services', async () => {
  const token = staffToken();
  const res = await call('/web/users/me', { method: 'PATCH', token, body: { currentPassword: password, newPassword } });
  assert.equal(res.status, 200, JSON.stringify(res)); await assertRevoked(token, 'staff');
});
test('captain password reset revokes all sessions of the target staff member', async () => {
  const token = staffToken();
  const res = await call(`/web/users/${ids[1]}/reset-password`, { method: 'PATCH', token: staffToken(1), body: { newPassword } });
  assert.equal(res.status, 200, JSON.stringify(res)); await assertRevoked(token, 'staff');
});
test('approval links lose access after password reset, and reject missing/tampered versions', async () => {
  const { tokenParams } = require('../lib/approveLink');
  const params = tokenParams(ids[1], 0);
  const request = (p) => call('/web/approvals?' + new URLSearchParams(p));
  assert.equal((await request(params)).status, 200);
  assert.equal((await request({ ...params, v: 1 })).status, 401);
  const { v, ...legacy } = params;
  assert.equal((await request(legacy)).status, 401);
  await call(`/web/users/${ids[1]}/reset-password`, { method: 'PATCH', token: staffToken(1), body: { newPassword } });
  assert.equal((await request(params)).status, 401);
});
test('kiosk rejects disabled/deleted linked accounts and allows unlinked walk-ins', async () => {
  const { verifyClearance } = require('../lib/purokClearance');
  const clearance = { controlNo: 'PC-A7K2-M9', fullName: 'QA Resident', status: 'issued', userId: ids[0] };
  const client = { ...db, purokClearance: { findUnique: async () => clearance } };
  const input = { controlNo: clearance.controlNo, surname: 'Resident' };
  assert.equal((await verifyClearance(input, client)).ok, true);
  residents[0].active = false;
  assert.equal((await verifyClearance(input, client)).reason, 'account_disabled');
  residents[0].active = true; residents[0].deletedAt = new Date();
  assert.equal((await verifyClearance(input, client)).reason, 'account_disabled');
  clearance.userId = null;
  assert.equal((await verifyClearance(input, client)).ok, true);
});
test('missing JWT secret fails closed in development as well as production', async () => {
  const saved = process.env.JWT_SECRET; delete process.env.JWT_SECRET;
  try {
    assert.throws(() => residentToken(), /JWT_SECRET/);
    assert.equal((await call('/web/auth/me', { token: ids[1] })).status, 401);
    for (const backend of backends) assert.equal((await call(`/${backend}/resident`, { token: ids[0] })).status, 401);
  } finally { process.env.JWT_SECRET = saved; }
});
