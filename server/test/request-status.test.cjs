// Real handlers with isolated, transactional database doubles. No live services.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const root = path.resolve(__dirname, '..');
const mobile = process.env.MOBILE_BACKEND_DIR && path.resolve(process.env.MOBILE_BACKEND_DIR);
const { STATUS, requestStatus, canonicalDocuments } = require('../lib/requestStatus');
const { transitionRequest, setClaimStatus } = require('../lib/requestWorkflow');
const uid = '11111111-1111-4111-8111-111111111111';
const otherUid = '22222222-2222-4222-8222-222222222222';
let state, fault, server, base, isolation;
const clone = (value) => structuredClone(value);
function addRequest(status, extra = {}) {
  const row = { id: crypto.randomUUID(), userId: uid, status, documentType: 'Barangay Clearance', purpose: 'Employment', paymentStatus: 'paid', purokLeaderStatus: 'approved', createdAt: new Date('2026-09-01'), ...extra };
  state.requests.push(row); return row;
}
function addRelease(request, extra = {}) {
  const row = { id: crypto.randomUUID(), requestId: request?.id || null, userId: request?.userId || uid, claimCode: 'CLM-' + state.documents.length, claimStatus: 'pending', claimedAt: null, completedAt: new Date('2026-09-02'), createdAt: new Date('2026-09-02'), documentType: 'Barangay Clearance', purpose: 'Employment', ...extra };
  state.documents.push(row); return row;
}
function matches(row, where = {}) {
  return row && Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some((part) => matches(row, part));
    if (value && typeof value === 'object') {
      if ('in' in value) return value.in.includes(row[key]);
      if ('equals' in value) return String(row[key]).toLowerCase() === String(value.equals).toLowerCase();
      return matches(row[key], value);
    }
    return row[key] === value;
  });
}
function hydrate(table, row) {
  if (table === 'requests') return { ...clone(row), completedDocuments: clone(state.documents.filter((d) => d.requestId === row.id)), user: { id: row.userId, username: 'QA', verificationProfile: { fullName: 'QA Resident', address: 'Purok 1', purok: 'Purok 1' } } };
  return { ...clone(row), request: clone(state.requests.find((r) => r.id === row.requestId) || null) };
}
function model(table) {
  function find(where) { return state[table].filter((r) => matches(hydrate(table, r), where)); }
  return {
    findMany: async ({ where } = {}) => find(where).map((r) => hydrate(table, r)),
    findUnique: async ({ where }) => { const row = find(where)[0]; return row ? hydrate(table, row) : null; },
    findFirst: async ({ where }) => { const row = find(where)[0]; return row ? hydrate(table, row) : null; },
    count: async ({ where } = {}) => find(where).length,
    create: async ({ data }) => {
      if (fault === table + '.create') throw new Error('Injected write failure');
      const row = { id: crypto.randomUUID(), createdAt: new Date(), claimedAt: null, ...clone(data) };
      state[table].push(row); return hydrate(table, row);
    },
    updateMany: async ({ where, data }) => {
      if (fault === table + '.updateMany') throw new Error('Injected write failure');
      const rows = find(where); rows.forEach((r) => Object.assign(r, clone(data))); return { count: rows.length };
    },
    update: async ({ where, data }) => {
      if (fault === table + '.update') throw new Error('Injected write failure');
      const row = find(where)[0]; if (!row) throw new Error('Missing fixture row');
      Object.assign(row, clone(data)); return hydrate(table, row);
    },
  };
}
const db = { request: model('requests'), completedDocument: model('documents'), verificationProfile: { findMany: async () => [{ userId: uid, purok: 'Purok 1', address: 'Purok 1' }] } };
let queue = Promise.resolve();
db.$transaction = (callback, options) => {
  isolation = options?.isolationLevel;
  const work = queue.then(async () => {
    const snapshot = clone(state);
    try { return await callback(db); } catch (error) { state = snapshot; throw error; }
  });
  queue = work.catch(() => {}); return work;
};
function stub(file, exports) {
  const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub(path.join(root, 'lib/prisma.js'), db);
stub(path.join(root, 'src/config/cloudinary.js'), {});
stub(path.join(root, 'src/utils/sendSms.js'), async () => {});
stub(path.join(root, 'src/utils/sendEmail.js'), async () => {});
stub(path.join(root, 'src/utils/auditLog.js'), async () => {});
stub(path.join(root, 'src/utils/generateORNumber.js'), async () => 'QA');
stub(path.join(root, 'lib/purokNotify.js'), { notifyPurokLeader: async () => ({ notified: true }) });
const resident = require('../src/controllers/resident.request.controller');
const staff = require('../src/controllers/request.controller');
const release = require('../src/controllers/release.controller');
const app = express(); app.use(express.json());
app.use((req, _res, next) => { req.resident = { id: uid }; req.user = { id: uid, purok: 'Purok 1' }; next(); });
app.get('/web/summary', resident.getSummary);
app.get('/web/requests', resident.getMyRequests);
app.get('/web/completed', resident.getMyCompleted);
app.get('/web/claimed', resident.getClaimed);
app.patch('/web/requests/:id/status', staff.updateStatus);
app.patch('/web/releases/:id/claim-status', release.updateClaimStatus);
app.get('/web/releases', release.getAll);
app.get('/web/purok-requests', require('../src/controllers/purokLeader.controller').getRequests);
app.get('/web/payment/:requestId', require('../src/controllers/resident.payment.controller').verifyPayment);
const backends = ['web'];
if (mobile) {
  stub(path.join(mobile, 'lib/prisma.js'), db);
  stub(path.join(mobile, 'middleware/auth.js'), (req, _res, next) => { req.user = { id: uid }; next(); });
  stub(path.join(mobile, 'middleware/adminAuth.js'), (_req, _res, next) => next());
  stub(path.join(mobile, 'services/sms.js'), { sendSms: async () => {} });
  stub(path.join(mobile, 'services/email.js'), { sendEmail: async () => {} });
  stub(path.join(mobile, 'lib/orNumber.js'), { nextOrNumber: async () => 'QA' });
  stub(path.join(mobile, 'lib/purokNotify.js'), { notifyPurokLeader: async () => ({ notified: true }) });
  app.use('/mobile', require(path.join(mobile, 'routes/requests')));
  app.use('/mobile/admin', require(path.join(mobile, 'routes/admin')));
  backends.push('mobile');
}
async function call(url, method = 'GET', body) {
  const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function summary(backend) {
  const result = await call('/' + backend + '/summary'); assert.equal(result.status, 200, JSON.stringify(result)); return result.body;
}
before(async () => {
  server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); });
beforeEach(() => { state = { requests: [], documents: [] }; fault = null; isolation = null; });

test('web and mobile use identical status and transition rules', { skip: !mobile }, () => {
  for (const name of ['requestStatus.js', 'requestWorkflow.js']) {
    const read = (folder) => fs.readFileSync(path.join(folder, 'lib', name), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(read(root), read(mobile));
  }
});
for (const backend of backends) {
  test(`${backend}: empty summary has one lowercase response contract`, async () => {
    assert.deepEqual(await summary(backend), { total: 0, pending: 0, processing: 0, printing: 0, ready: 0, claimed: 0, rejected: 0, readyDocuments: [] });
    assert.equal(isolation, 'RepeatableRead');
  });
  test(`${backend}: two completed documents produce two pickup items, including old null defaults`, async () => {
    addRelease(addRequest('Completed', { channel: 'web' }));
    addRelease(addRequest('Completed', { channel: 'kiosk' }), { claimStatus: null, completedAt: null });
    const data = await summary(backend);
    assert.equal(data.total, 2); assert.equal(data.ready, 2); assert.equal(data.readyDocuments.length, 2);
    assert.ok(data.readyDocuments.every((d) => d.status === STATUS.ready && d.claimStatus === 'pending' && d.completedAt));
    const list = await call('/' + backend + '/completed?status=pending');
    assert.equal(list.body.length, data.ready);
  });
  test(`${backend}: completed/ready strings without actual release records stay in Printing`, async () => {
    addRequest('Completed'); addRequest('Ready');
    const data = await summary(backend); assert.equal(data.ready, 0); assert.equal(data.printing, 2);
    const result = await call(backend === 'web' ? '/web/requests' : '/mobile');
    assert.deepEqual(result.body.map((r) => r.status), [STATUS.printing, STATUS.printing]);
  });
  test(`${backend}: all six meanings agree across web, mobile and kiosk origins`, async () => {
    addRequest('Pending', { channel: 'web' }); addRequest('Processing', { channel: 'mobile' }); addRequest('Printing', { channel: 'kiosk' });
    addRelease(addRequest('Ready', { channel: 'mobile' }), { claimStatus: 'PeNdInG' });
    addRelease(addRequest('Completed'), { claimStatus: 'COMPLETED' });
    addRequest('Pending', { purokLeaderStatus: 'rejected' });
    const { readyDocuments, ...counts } = await summary(backend);
    assert.deepEqual(counts, { total: 6, pending: 1, processing: 1, printing: 1, ready: 1, claimed: 1, rejected: 1 });
    assert.equal((await call('/' + backend + '/claimed')).body.length, 1);
    assert.equal(readyDocuments[0].status, STATUS.ready);
  });
  test(`${backend}: claimed timestamps and stale Claimed requests never count as pickup`, async () => {
    addRelease(addRequest('Completed'), { claimStatus: 'Pending', claimedAt: new Date() });
    addRelease(addRequest('Claimed'), { claimStatus: null });
    const data = await summary(backend); assert.equal(data.ready, 0); assert.equal(data.claimed, 2);
  });
  test(`${backend}: duplicate release rows are one pickup and handover evidence wins`, async () => {
    const request = addRequest('Completed'); addRelease(request); const second = addRelease(request);
    assert.equal((await summary(backend)).ready, 1);
    second.claimStatus = 'complete';
    const data = await summary(backend); assert.equal(data.ready, 0); assert.equal(data.claimed, 1);
  });
  test(`${backend}: summaries and lists exclude another resident, including mismatched ownership`, async () => {
    const own = addRequest('Completed'), other = addRequest('Completed', { userId: otherUid });
    addRelease(own, { userId: null }); // imported record linked to this resident
    addRelease(other); addRelease(other, { userId: uid });
    const data = await summary(backend); assert.equal(data.total, 1); assert.equal(data.ready, 1);
    assert.equal((await call('/' + backend + '/completed?status=pending')).body.length, 1);
  });
  test(`${backend}: rejected releases and unknown claim states never advertise pickup`, async () => {
    addRelease(addRequest('Rejected')); addRelease(addRequest('Completed'), { claimStatus: 'unknown' });
    assert.equal((await summary(backend)).ready, 0);
  });
  test(`${backend}: marking ready atomically creates a usable release and claim code`, async () => {
    const request = addRequest('Printing', { channel: backend === 'web' ? 'kiosk' : 'mobile' });
    const result = await call(backend === 'web' ? `/web/requests/${request.id}/status` : `/mobile/admin/requests/${request.id}/status`, backend === 'web' ? 'PATCH' : 'PUT', { status: backend === 'web' ? 'Completed' : 'Ready' });
    assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(result.body.status, STATUS.ready);
    assert.equal(state.documents.length, 1); assert.equal(state.documents[0].claimStatus, 'pending');
    assert.ok(state.documents[0].completedAt instanceof Date); assert.match(state.documents[0].claimCode, /^CLM-/);
    assert.equal(state.requests[0].claimCode, state.documents[0].claimCode);
    for (const target of backends) assert.equal((await summary(target)).ready, 1);
  });
}
test('claiming and undoing a handover update both channels and preserve the claim timestamp on retry', async () => {
  const request = addRequest('Completed'), doc = addRelease(request);
  let result = await call(`/web/releases/${doc.id}/claim-status`, 'PATCH', { claimStatus: 'claimed' });
  assert.equal(result.status, 200); const claimedAt = result.body.claimedAt;
  for (const backend of backends) { const data = await summary(backend); assert.equal(data.ready, 0); assert.equal(data.claimed, 1); }
  assert.equal(state.requests[0].status, STATUS.claimed);
  result = await call(`/web/releases/${doc.id}/claim-status`, 'PATCH', { claimStatus: 'claimed' }); assert.equal(result.body.claimedAt, claimedAt);
  result = await call(`/web/releases/${doc.id}/claim-status`, 'PATCH', { claimStatus: 'pending' });
  assert.equal(result.status, 200); assert.equal(result.body.claimedAt, null);
  for (const backend of backends) { const data = await summary(backend); assert.equal(data.ready, 1); assert.equal(data.claimed, 0); }
});
test('completion retries and simultaneous submissions do not issue duplicate claim codes', async () => {
  const request = addRequest('Printing');
  const results = await Promise.all([transitionRequest(db, request.id, STATUS.ready), transitionRequest(db, request.id, STATUS.ready)]);
  assert.equal(state.documents.length, 1); assert.equal(results.filter((r) => r.newlyReady).length, 1);
});
test('a release creation failure rolls back the request status', async () => {
  const request = addRequest('Printing'); fault = 'documents.create';
  await assert.rejects(transitionRequest(db, request.id, STATUS.ready), /Injected/);
  assert.equal(state.requests[0].status, STATUS.printing); assert.equal(state.documents.length, 0);
});
test('a request update failure rolls back the handover and its timestamp', async () => {
  const doc = addRelease(addRequest('Completed')); fault = 'requests.update';
  await assert.rejects(setClaimStatus(db, doc.id, 'claimed'), /Injected/);
  assert.equal(state.documents[0].claimStatus, 'pending'); assert.equal(state.documents[0].claimedAt, null);
});
test('invalid claim statuses and unpaid/skipped workflow stages are rejected without writes', async () => {
  const request = addRequest('Pending', { paymentStatus: 'unpaid' }), doc = addRelease(null);
  await assert.rejects(setClaimStatus(db, doc.id, 'Completed'), (e) => e.status === 400);
  await assert.rejects(transitionRequest(db, request.id, STATUS.ready), (e) => e.status === 400);
  await assert.rejects(transitionRequest(db, request.id, STATUS.printing), (e) => e.status === 400);
  assert.equal(state.requests[0].status, STATUS.pending); assert.equal(state.documents[0].claimStatus, 'pending');
});
test('a claimed request cannot be put back into the printing workflow by a status update', async () => {
  const request = addRequest('Claimed'); addRelease(request, { claimStatus: 'claimed' });
  await assert.rejects(transitionRequest(db, request.id, STATUS.printing), (e) => e.status === 400);
});
test('claim aliases are exact, and terminal request state overrides a stale release row', () => {
  assert.equal(canonicalDocuments([{ id: 'a', claimStatus: 'unclaimed' }])[0].status, STATUS.ready);
  assert.equal(canonicalDocuments([{ id: 'a', claimStatus: 'incomplete' }]).length, 0);
  assert.equal(requestStatus({ status: 'Claimed', completedDocuments: [{ id: 'a', claimStatus: 'pending' }] }), STATUS.claimed);
});
test('Purok request responses and paid-payment checks expose the same canonical status', async () => {
  const request = addRequest('Completed'); addRelease(request);
  const queue = await call('/web/purok-requests');
  assert.equal(queue.status, 200); assert.equal(queue.body[0].status, STATUS.ready);
  const payment = await call('/web/payment/' + request.id);
  assert.equal(payment.status, 200); assert.equal(payment.body.status, STATUS.ready);
});
