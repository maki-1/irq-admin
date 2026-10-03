// Real routes, authorization and handlers with an isolated database double.
// No live database, provider, media upload, email or SMS is used.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { signToken } = require('../lib/accountLifecycle');
const { todayInManila, validateBirthday } = require('../lib/birthday');
const uid = '11111111-1111-4111-8111-111111111111';
const leaderId = '22222222-2222-4222-8222-222222222222';
const captainId = '33333333-3333-4333-8333-333333333333';
const rid = '44444444-4444-4444-8444-444444444444';
const otherUid = '55555555-5555-4555-8555-555555555555';
let state, fault, uploads, server, base;
const clone = (value) => structuredClone(value);
function matches(row, where = {}) {
  return !!row && Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some((part) => matches(row, part));
    if (key === 'AND') return value.every((part) => matches(row, part));
    if (value && typeof value === 'object') {
      if ('in' in value) return value.in.includes(row[key]);
      if ('equals' in value) return String(row[key]).toLowerCase() === String(value.equals).toLowerCase();
      if ('contains' in value) return String(row[key]).toLowerCase().includes(String(value.contains).toLowerCase());
      if ('none' in value) return !(row[key] || []).some((entry) => matches(entry, value.none));
    }
    return row[key] === value;
  });
}
function model(table) {
  const find = (where) => state[table].find((row) => matches(row, where));
  return {
    findUnique: async ({ where }) => clone(find(where) || null),
    findFirst: async ({ where }) => clone(find(where) || null),
    findMany: async ({ where } = {}) => clone(state[table].filter((row) => matches(row, where))),
    create: async ({ data }) => {
      if (fault === table) throw new Error('Injected failure');
      const row = { id: crypto.randomUUID(), ...clone(data) }; state[table].push(row); return clone(row);
    },
    update: async ({ where, data }) => {
      if (fault === 'concurrent' && table === 'requests') throw Object.assign(new Error('Record changed'), { code: 'P2025' });
      const row = find(where);
      if (!row) throw Object.assign(new Error('Not found'), { code: 'P2025' });
      Object.assign(row, clone(data)); return clone(row);
    },
    updateMany: async ({ where, data }) => {
      const rows = state[table].filter((row) => matches(row, where));
      rows.forEach((row) => Object.assign(row, clone(data)));
      return { count: rows.length };
    },
    upsert: async ({ where, create, update }) => {
      const row = find(where);
      if (row) { Object.assign(row, clone(update)); return clone(row); }
      state[table].push(clone(create)); return clone(create);
    },
  };
}
const db = {
  user: model('users'), admin: model('admins'), request: model('requests'),
  verificationProfile: model('profiles'), auditTrail: model('audits'),
  purokClearanceFee: { findMany: async () => [{ purokName: 'Purok 1', feecentavos: 2000 }], findUnique: async () => ({ feecentavos: 2000 }) },
};
let queue = Promise.resolve();
db.$transaction = (run) => {
  const result = queue.then(async () => {
    const saved = clone(state);
    try { return await run(db); } catch (err) { state = saved; throw err; }
  });
  queue = result.catch(() => {});
  return result;
};
function stub(file, exports) {
  const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub('../lib/prisma', db);
stub('../src/config/cloudinary', { uploader: { upload_stream: () => { uploads++; throw new Error('Unexpected upload'); } } });
const app = express(); app.use(express.json());
app.use('/verification', require('../src/routes/resident.verification.routes'));
app.use('/users', require('../src/routes/user.routes'));
app.use('/purok-leader', require('../src/routes/purokLeader.routes'));
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); });
beforeEach(() => {
  process.env.JWT_SECRET = 'isolated-resident-improvements-test-key';
  uploads = 0; fault = null;
  state = {
    users: [{ id: uid, active: true, contactVerified: true, sessionVersion: 0, deletedAt: null, isVerified: false, verificationStep: 0 }],
    admins: [
      { id: leaderId, fullName: 'QA Leader', role: 'Purok Leader', purok: 'Purok 1', active: true, sessionVersion: 0 },
      { id: captainId, fullName: 'QA Captain', role: 'Barangay Captain', active: true, sessionVersion: 0 },
    ],
    profiles: [{ userId: uid, purok: 'Purok 1', address: 'Purok 1, Dologon' }, { userId: otherUid, purok: 'Purok 10', address: 'Purok 10, Dologon' }],
    requests: [{ id: rid, userId: uid, documentType: 'Barangay Clearance', status: 'Rejected',
      purokLeaderStatus: 'rejected', purokLeaderAt: new Date('2026-10-01'), purokLeaderBy: leaderId,
      purokLeaderRemarks: 'Address needs correction', purokClearanceFee: 20,
      paymentStatus: 'paid', amountPaid: 100, orNumber: 'QA-OR', completedDocuments: [] }],
    audits: [],
  };
});
async function call(url, { method = 'PATCH', body = {}, account = 'leader', anonymous = false, token: suppliedToken } = {}) {
  const record = account === 'resident' ? state.users[0] : state.admins[account === 'captain' ? 1 : 0];
  const token = anonymous ? null : suppliedToken || signToken(record, account === 'resident' ? 'resident' : 'staff');
  const response = await fetch(base + url, { method, headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
const restore = (opts) => call(`/purok-leader/requests/${rid}/restore`, opts);
const personal = { firstName: 'QA', lastName: 'Resident', gender: 'Female', birthday: '2000-02-29', street: 'Purok 1', purok: 'Purok 1', barangay: 'Dologon', city: 'Maramag' };
const account = { fullName: 'QA New User', email: 'new@example.invalid', password: 'test-password', role: 'Secretary' };

test('birthday cutoff uses the Philippine calendar day, including midnight and leap days', () => {
  assert.equal(todayInManila(new Date('2026-10-02T15:59:59Z')), '2026-10-02');
  const midnight = new Date('2026-10-02T16:00:00Z');
  assert.equal(todayInManila(midnight), '2026-10-03');
  assert.equal(validateBirthday('2026-10-03', midnight).age, 0);
  assert.match(validateBirthday('2026-10-04', midnight).error, /later than today/);
  assert.equal(validateBirthday('2000-02-29', midnight).age, 26);
  assert.ok(validateBirthday('2025-02-29', midnight).error);
});
for (const birthday of ['2999-01-01', '2025-02-29', '2026-13-01', 'not-a-date', '2000-01-01T00:00:00Z']) {
  test(`registration rejects invalid/future birthday ${birthday} without saving`, async () => {
    const saved = clone(state);
    const result = await call('/verification/step1', { method: 'POST', account: 'resident', body: { ...personal, birthday } });
    assert.equal(result.status, 400, JSON.stringify(result));
    assert.deepEqual(state, saved); assert.equal(uploads, 0);
  });
}
test('registration accepts today and calculates age without trusting submitted age/senior flags', async () => {
  const result = await call('/verification/step1', { method: 'POST', account: 'resident', body: { ...personal, birthday: todayInManila(), age: 99, isSenior: true } });
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(state.profiles[0].age, 0); assert.equal(state.profiles[0].isSenior, false);
  assert.equal(state.users[0].verificationStep, 1);
});
for (const contactNumber of ['0912345678', '091234567890', '09123abc456', '+639123456789', '0912 345 6789', '12345678901']) {
  test(`admin create/edit reject invalid 11-digit contact ${contactNumber}`, async () => {
    const saved = clone(state);
    for (const [url, method, body] of [['/users', 'POST', { ...account, contactNumber }], [`/users/${leaderId}`, 'PATCH', { contactNumber }]]) {
      const result = await call(url, { method, body, account: 'captain' });
      assert.equal(result.status, 400, JSON.stringify(result)); assert.match(result.body.message, /11 digits/);
    }
    assert.deepEqual(state, saved);
  });
}
test('admin create and edit accept an 11-digit mobile number', async () => {
  const result = await call('/users', { method: 'POST', account: 'captain', body: { ...account, contactNumber: '09123456789' } });
  assert.equal(result.status, 201, JSON.stringify(result)); assert.equal(result.body.contactNumber, '09123456789');
  assert.equal((await call(`/users/${leaderId}`, { account: 'captain', body: { contactNumber: '09987654321' } })).status, 200);
});
test('notification email still permits creating a leader without an optional phone', async () => {
  const result = await call('/users', { method: 'POST', account: 'captain', body: { ...account, role: 'Purok Leader', purok: 'Purok 1', contactNumber: '', notifyEmail: 'leader@example.invalid' } });
  assert.equal(result.status, 201, JSON.stringify(result)); assert.equal(result.body.contactNumber, null);
});
test('restore returns rejected request to Pending, keeps payment records and audits its rejection reason', async () => {
  const result = await restore(); assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.body.status, 'Pending'); assert.equal(result.body.purokLeaderStatus, 'pending');
  assert.equal(result.body.purokLeaderRemarks, ''); assert.equal(result.body.purokLeaderBy, null); assert.equal(result.body.purokLeaderAt, null);
  assert.equal(result.body.purokClearanceFee, 0); assert.equal(result.body.paymentStatus, 'paid'); assert.equal(result.body.amountPaid, 100); assert.equal(result.body.orNumber, 'QA-OR');
  assert.equal(state.audits.length, 1); assert.match(state.audits[0].details, /Address needs correction/);
  assert.equal((await restore()).status, 404); assert.equal(state.audits.length, 1);
});
test('restored request can be reviewed and rejected again with a new decision timestamp', async () => {
  const first = state.requests[0].purokLeaderAt;
  assert.equal((await restore()).status, 200);
  const rejected = await call(`/purok-leader/requests/${rid}/reject`, { body: { remarks: 'Updated rejection reason' } });
  assert.equal(rejected.status, 200, JSON.stringify(rejected)); assert.equal(rejected.body.purokLeaderStatus, 'rejected');
  assert.notEqual(rejected.body.purokLeaderAt, first.toISOString()); assert.equal(rejected.body.purokLeaderRemarks, 'Updated rejection reason');
});
test('archive restore requires authenticated active Purok Leader', async () => {
  assert.equal((await restore({ anonymous: true })).status, 401);
  assert.equal((await restore({ account: 'resident' })).status, 401);
  assert.equal((await restore({ account: 'captain' })).status, 403);
  const token = signToken(state.admins[0], 'staff');
  state.admins[0].active = false; assert.equal((await restore({ token })).status, 403);
  assert.equal(state.requests[0].status, 'Rejected'); assert.equal(state.audits.length, 0);
});
test('leader cannot restore another purok or restore without an assigned purok', async () => {
  state.requests[0].userId = otherUid;
  assert.equal((await restore()).status, 404);
  state.requests[0].userId = uid; state.admins[0].purok = '';
  assert.equal((await restore()).status, 404); assert.equal(state.audits.length, 0);
});
test('restore refuses pending, approved, and already released requests', async () => {
  for (const status of ['pending', 'approved']) {
    state.requests[0].purokLeaderStatus = status; assert.equal((await restore()).status, 404);
  }
  state.requests[0].purokLeaderStatus = 'rejected'; state.requests[0].completedDocuments = [{ id: 'released' }];
  assert.equal((await restore()).status, 404); assert.equal(state.audits.length, 0);
});
test('restore rolls back if the audit write fails and handles a concurrent decision', async () => {
  const saved = clone(state); fault = 'audits';
  assert.equal((await restore()).status, 500); assert.deepEqual(state, saved);
  fault = 'concurrent'; assert.equal((await restore()).status, 409); assert.deepEqual(state, saved);
});
