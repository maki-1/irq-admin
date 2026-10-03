// Real routes/auth and transactional in-memory DB. No live residents/providers.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const root = path.resolve(__dirname, '..');
const mobile = process.env.MOBILE_BACKEND_DIR && path.resolve(process.env.MOBILE_BACKEND_DIR);
const policy = require('../lib/accountLifecycle');
process.env.JWT_SECRET = 'resident-contact-isolated-test-secret';
const uid = '11111111-1111-4111-8111-111111111111';
const pid = '22222222-2222-4222-8222-222222222222';
const aid = '33333333-3333-4333-8333-333333333333';
const otherId = '44444444-4444-4444-8444-444444444444';
let state, fault, server, base, tick;
const clone = (x) => x == null ? x : structuredClone(x);
function matches(row, where = {}) {
  return row && Object.entries(where).every(([key, value]) => {
    if (value instanceof Date) return new Date(row[key]).getTime() === value.getTime();
    if (value && typeof value === 'object') {
      if ('not' in value) return row[key] !== value.not;
      if ('equals' in value) return value.mode === 'insensitive' ? String(row[key]).toLowerCase() === String(value.equals).toLowerCase() : row[key] === value.equals;
    }
    return row[key] === value;
  });
}
function shape(table, row, { select, include } = {}) {
  if (!row) return null;
  const result = select ? Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, clone(row[key])])) : clone(row);
  if (table === 'profiles' && include?.user) result.user = shape('users', state.users.find((u) => u.id === row.userId), include.user);
  return result;
}
function model(table) {
  function apply(row, data) {
    if (table === 'users') for (const key of ['email', 'contactNumber']) {
      if (data[key] != null && state.users.some((other) => other.id !== row.id && other[key] === data[key])) throw Object.assign(new Error('Duplicate'), { code: 'P2002', meta: { target: [key] } });
    }
    for (const [key, value] of Object.entries(data)) row[key] = value && typeof value === 'object' && 'increment' in value ? row[key] + value.increment : clone(value);
    row.updatedAt = new Date(Date.UTC(2026, 9, 3, 0, 0, ++tick));
  }
  return {
    findUnique: async (args) => shape(table, state[table].find((r) => matches(r, args.where)), args),
    findFirst: async (args) => shape(table, state[table].find((r) => matches(r, args.where)), args),
    findMany: async (args = {}) => state[table].filter((r) => matches(r, args.where)).map((r) => shape(table, r, args)),
    updateMany: async ({ where, data }) => {
      if (fault === 'conflict') return { count: 0 };
      if (fault === 'unique') throw Object.assign(new Error('Concurrent duplicate'), { code: 'P2002', meta: { target: ['email'] } });
      const rows = state[table].filter((r) => matches(r, where)); rows.forEach((r) => apply(r, data)); return { count: rows.length };
    },
    update: async (args) => {
      if (fault === table + '.update') throw new Error('Injected failure');
      const row = state[table].find((r) => matches(r, args.where));
      if (!row) throw Object.assign(new Error('Missing row'), { code: 'P2025' });
      apply(row, args.data); return shape(table, row, args);
    },
    deleteMany: async ({ where }) => { const count = state[table].filter((r) => matches(r, where)).length; state[table] = state[table].filter((r) => !matches(r, where)); return { count }; },
    create: async ({ data }) => { if (fault === table + '.create') throw new Error('Injected failure'); state[table].push(clone(data)); return clone(data); },
  };
}
const db = { user: model('users'), admin: model('admins'), verificationProfile: model('profiles'), otpCode: model('otps'), auditTrail: model('audit') };
let queue = Promise.resolve();
db.$transaction = (callback) => {
  const work = queue.then(async () => { const saved = clone(state); try { return await callback(db); } catch (error) { state = saved; throw error; } });
  queue = work.catch(() => {}); return work;
};
function stub(file, exports) { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub(path.join(root, 'lib/prisma.js'), db);
stub(path.join(root, 'src/utils/sendSms.js'), async () => { throw new Error('Unexpected delivery'); });
stub(path.join(root, 'src/utils/sendEmail.js'), async () => { throw new Error('Unexpected delivery'); });
const app = express(); app.use(express.json());
app.use('/verifications', require('../src/routes/verification.routes'));
app.get('/web/resident', require('../src/middleware/residentAuth').residentProtect, (_req, res) => res.json({ ok: true }));
if (mobile) {
  stub(path.join(mobile, 'lib/prisma.js'), db);
  app.get('/mobile/resident', require(path.join(mobile, 'middleware/auth')), (_req, res) => res.json({ ok: true }));
}
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve)); base = 'http://127.0.0.1:' + server.address().port; });
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); });
beforeEach(() => {
  tick = 0; fault = null;
  const date = new Date('2026-09-01T00:00:00Z');
  state = {
    users: [
      { id: uid, username: 'qa_resident', email: 'old@example.invalid', contactNumber: '09999999999', password: 'private-hash', sessionVersion: 4, active: true, deletedAt: null, isVerified: true, contactVerified: true, contactVerifiedAt: date, verificationStep: 3, verificationStatus: 'approved', otp: '123456', otpType: 'reset', otpAttempts: 2, otpExpires: date, resetToken: 'old-reset', resetTokenExpires: date, createdAt: date, updatedAt: date },
      { id: otherId, email: 'taken@example.invalid', contactNumber: '09888888888' },
    ],
    admins: [{ id: aid, fullName: 'QA Captain', role: 'Barangay Captain', sessionVersion: 0, active: true }],
    profiles: [{ id: pid, userId: uid, fullName: 'QA Resident', email: 'old@example.invalid', contactNumber: '09999999999', status: 'approved', archived: false, facePhoto: 'qa-face.png', createdAt: date, updatedAt: date }],
    otps: [{ userId: uid, code: 'hashed-otp', type: 'reset' }, { userId: otherId, code: 'other-otp' }], audit: [],
  };
});
const staffToken = () => policy.signToken(state.admins[0], 'staff');
async function call(url, { body, token = staffToken(), method = body === undefined ? 'GET' : 'PATCH' } = {}) {
  const result = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: result.status, body: await result.json() };
}
const edit = (body, options = {}) => call('/verifications/' + pid + '/contact', { body, ...options });
test('captain edits both contacts atomically, normalizes input and records actor', async () => {
  const result = await edit({ email: '  New@Example.invalid ', contactNumber: '+63 977 777 7777', expectedUpdatedAt: state.users[0].updatedAt.toISOString() });
  assert.equal(result.status, 200, JSON.stringify(result));
  for (const row of [state.users[0], state.profiles[0], result.body]) { assert.equal(row.email, 'new@example.invalid'); assert.equal(row.contactNumber, '09777777777'); }
  assert.equal(result.body._id, pid); assert.equal(result.body.user.email, 'new@example.invalid'); assert.equal(result.body.user.password, undefined);
  assert.equal(state.audit.length, 1); assert.equal(state.audit[0].adminId, aid); assert.match(state.audit[0].details, /email, contactNumber/);
});
test('editing contacts preserves password, approval, contact-verification and activity', async () => {
  const previous = clone(state.users[0]); await edit({ email: 'new@example.invalid' });
  for (const key of ['password', 'isVerified', 'contactVerified', 'contactVerifiedAt', 'verificationStep', 'verificationStatus', 'active', 'deletedAt']) assert.deepEqual(state.users[0][key], previous[key], key);
  assert.equal(state.profiles[0].status, 'approved'); assert.equal(state.users[0].contactNumber, previous.contactNumber);
});
test('contact changes invalidate old recovery credentials and web/mobile sessions', async () => {
  const token = policy.signToken(state.users[0], 'resident');
  assert.equal((await call('/web/resident', { token })).status, 200);
  if (mobile) assert.equal((await call('/mobile/resident', { token })).status, 200);
  await edit({ contactNumber: '09777777777' });
  assert.equal(state.users[0].sessionVersion, 5); assert.equal(state.users[0].otpAttempts, 0);
  for (const key of ['otp', 'otpExpires', 'otpType', 'resetToken', 'resetTokenExpires']) assert.equal(state.users[0][key], null);
  assert.deepEqual(state.otps.map((otp) => otp.userId), [otherId]);
  assert.equal((await call('/web/resident', { token })).status, 401);
  if (mobile) assert.equal((await call('/mobile/resident', { token })).status, 401);
});
test('email can be cleared without changing phone and remains cleared on reads', async () => {
  const result = await edit({ email: '' }); assert.equal(result.status, 200); assert.equal(result.body.email, '');
  assert.equal(state.users[0].email, null); assert.equal(state.profiles[0].email, null);
  assert.equal((await call('/verifications/' + pid)).body.email, '');
  assert.equal((await call('/verifications')).body[0].email, '');
});
test('profile lists read the actual account contact even when profile contact is stale', async () => {
  state.profiles[0].email = 'stale@example.invalid'; state.profiles[0].contactNumber = null;
  for (const response of [(await call('/verifications')).body[0], (await call('/verifications/' + pid)).body]) {
    assert.equal(response.email, state.users[0].email); assert.equal(response.contactNumber, state.users[0].contactNumber);
    for (const key of ['password', 'otp', 'resetToken', 'sessionVersion']) assert.equal(response.user[key], undefined);
  }
});
for (const [name, body, field] of [
  ['invalid email', { email: 'bad-email' }, 'email'],
  ['email object', { email: { address: 'qa@example.invalid' } }, 'email'],
  ['empty phone', { contactNumber: '' }, 'contactNumber'],
  ['non-PH phone', { contactNumber: '+12025550123' }, 'contactNumber'],
  ['letters in phone', { contactNumber: '09abc999999999' }, 'contactNumber'],
  ['phone as number', { contactNumber: 9999999999 }, 'contactNumber'],
  ['overposting verification', { email: 'new@example.invalid', isVerified: true }, undefined],
  ['empty payload', {}, undefined],
]) test(name + ' is rejected without writes', async () => {
  const saved = clone(state); const response = await edit(body); assert.equal(response.status, 400); assert.equal(response.body.field, field); assert.deepEqual(state, saved);
});
for (const [name, body, field] of [
  ['case-insensitive duplicate email', { email: 'TAKEN@EXAMPLE.INVALID' }, 'email'],
  ['duplicate phone', { contactNumber: '+639888888888', email: 'new@example.invalid' }, 'contactNumber'],
]) test(name + ' returns a conflict without partial updates', async () => {
  const saved = clone(state); const response = await edit(body); assert.equal(response.status, 409); assert.equal(response.body.field, field); assert.deepEqual(state, saved);
});
test('database uniqueness conflicts caused by competing writes are returned as 409', async () => {
  fault = 'unique'; const saved = clone(state); const response = await edit({ email: 'new@example.invalid' }); assert.equal(response.status, 409); assert.deepEqual(state, saved);
});
test('stale forms and competing account writes cannot overwrite changes', async () => {
  const saved = clone(state);
  assert.equal((await edit({ email: 'new@example.invalid', expectedUpdatedAt: '2020-01-01T00:00:00Z' })).status, 409);
  fault = 'conflict'; assert.equal((await edit({ email: 'new@example.invalid' })).status, 409); assert.deepEqual(state, saved);
});
for (const target of ['profiles.update', 'audit.create']) test(target + ' failure rolls back contacts, session version and OTP deletion', async () => {
  fault = target; const saved = clone(state); assert.equal((await edit({ email: 'new@example.invalid' })).status, 500); assert.deepEqual(state, saved);
});
test('unchanged saves do not revoke sessions or create duplicate audit records', async () => {
  const saved = clone(state); assert.equal((await edit({ email: 'OLD@example.invalid', contactNumber: '+639999999999' })).status, 200); assert.deepEqual(state, saved);
});
test('repairing stale profile contacts keeps unchanged account sessions valid', async () => {
  state.profiles[0].email = null; assert.equal((await edit({ email: 'old@example.invalid' })).status, 200);
  assert.equal(state.profiles[0].email, 'old@example.invalid'); assert.equal(state.users[0].sessionVersion, 4); assert.equal(state.otps.length, 2);
});
test('disabled residents may be corrected without reactivation; deleted residents cannot', async () => {
  state.users[0].active = false; assert.equal((await edit({ email: 'new@example.invalid' })).status, 200); assert.equal(state.users[0].active, false);
  state.users[0].deletedAt = new Date(); const saved = clone(state); assert.equal((await edit({ email: 'another@example.invalid' })).status, 409); assert.deepEqual(state, saved);
});
test('missing or malformed profile identifiers return 404', async () => {
  for (const id of ['not-a-uuid', otherId]) assert.equal((await call('/verifications/' + id + '/contact', { body: { email: '' } })).status, 404);
});
test('only an active Captain can edit resident contacts', async () => {
  assert.equal((await edit({ email: '' }, { token: null })).status, 401);
  assert.equal((await edit({ email: '' }, { token: policy.signToken(state.users[0], 'resident') })).status, 401);
  for (const role of ['Secretary', 'Collector', 'Purok Leader']) { state.admins[0].role = role; assert.equal((await edit({ email: '' })).status, 403, role); }
  state.admins[0].role = 'Barangay Captain'; const token = staffToken(); state.admins[0].active = false;
  assert.equal((await edit({ email: '' }, { token })).status, 403); assert.equal(state.audit.length, 0);
});
