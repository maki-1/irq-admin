// Real resident routes/auth; provider, media storage, and DB are isolated doubles.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { signToken } = require('../lib/accountLifecycle');
const uid = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const pid = '33333333-3333-4333-8333-333333333333';
const sid = '44444444-4444-4444-8444-444444444444';
const wid = '55555555-5555-4555-8555-555555555555';
const origin = 'https://resident.example.test';
let state, report, calls, uploads, fault, server, base;
const clone = (value) => structuredClone(value);
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => value && typeof value === 'object'
    ? !value.notIn.includes(row[key]) : row[key] === value);
}
function model(table) {
  return {
    findUnique: async ({ where }) => clone(state[table].find((row) => matches(row, where)) || null),
    updateMany: async ({ where, data }) => {
      if (fault === table) throw new Error('Injected DB failure');
      const rows = state[table].filter((row) => matches(row, where));
      rows.forEach((row) => Object.assign(row, clone(data)));
      return { count: rows.length };
    },
  };
}
const db = { user: model('users'), verificationProfile: model('profiles') };
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
  const id = require.resolve(file);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub('../lib/prisma', db);
stub('../src/config/cloudinary', { uploader: { upload: async (url, options) => {
  uploads.push({ url, options });
  if (fault === 'media') throw new Error('Injected media failure');
  return { secure_url: `https://res.cloudinary.com/qa/${options.public_id}.jpg` };
} } });
axios.post = async (url, body, options) => {
  calls.push({ method: 'POST', url, body, options });
  if (fault === 'provider') throw Object.assign(new Error('Provider rejected request'), { response: { status: 403, data: { secret: 'never-return-me' } } });
  return { data: { session_id: sid, workflow_id: wid, vendor_data: body.vendor_data,
    url: fault === 'redirect' ? 'https://attacker.example/session' : 'https://verify.didit.me/session/qa-token' } };
};
axios.get = async (url, options) => { calls.push({ method: 'GET', url, options }); return { data: clone(report) }; };
const didit = require('../src/utils/diditVerification');
const app = express(); app.use(express.json());
app.use('/api/verification', require('../src/routes/resident.verification.routes'));
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/verification`;
});
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); });
beforeEach(() => {
  process.env.JWT_SECRET = 'didit-isolated-test-secret';
  delete process.env.LIVENESS_SESSION_SECRET;
  process.env.DIDIT_API_KEY = 'didit-test-key';
  process.env.DIDIT_WORKFLOW_ID = wid;
  process.env.CLIENT_URL = origin;
  calls = []; uploads = []; fault = null;
  state = {
    users: [uid, other].map((id) => ({ id, active: true, deletedAt: null, sessionVersion: 0, contactVerified: true, isVerified: false, verificationStep: 2, verificationStatus: null })),
    profiles: [{ id: pid, userId: uid, status: 'submitted', fullName: 'QA Resident', address: 'Existing address', aiVerification: null }],
  };
  report = {
    session_id: sid, workflow_id: wid, vendor_data: uid, metadata: { profile_id: pid },
    environment: 'live', status: 'Approved',
    id_verifications: [{ status: 'Approved', document_type: 'Identity Card', full_name: 'QA Resident', front_image: 'https://media.didit.me/front.jpg', back_image: 'https://media.didit.me/back.jpg' }],
    liveness_checks: [{ status: 'Approved', method: 'PASSIVE', score: 95, reference_image: 'https://media.didit.me/selfie.jpg' }],
    face_matches: [{ status: 'Approved', score: 94 }],
  };
});
async function call(path, body = {}, options = {}) {
  const resident = state.users.find((row) => row.id === (options.user || uid));
  const token = options.anonymous ? null : signToken(resident, 'resident');
  const response = await fetch(base + path, { method: 'POST', headers: {
    'Content-Type': 'application/json', Origin: options.origin || origin,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const start = () => call('/identity/session');
async function complete() {
  const created = await start();
  assert.equal(created.status, 200);
  return call('/identity/complete', { resumeToken: created.body.resumeToken });
}

test('session creation binds the resident and application; keeps API key on server', async () => {
  const result = await start();
  assert.equal(result.status, 200);
  const claims = jwt.decode(result.body.resumeToken);
  assert.equal(claims.sub, uid); assert.equal(claims.profileId, pid);
  assert.equal(claims.purpose, 'didit-session');
  assert.equal(calls[0].body.vendor_data, uid);
  assert.equal(calls[0].body.callback, origin + '/verify/step3?verification=return');
  assert.equal(calls[0].body.callback_method, 'initiator');
  assert.equal(calls[0].options.headers['x-api-key'], 'didit-test-key');
  assert.ok(!JSON.stringify(result.body).includes('didit-test-key'));
});
test('requires resident authentication and approved portal origin', async () => {
  assert.equal((await call('/identity/session', {}, { anonymous: true })).status, 401);
  assert.equal((await call('/identity/session', {}, { origin: 'https://attacker.example' })).status, 403);
  assert.equal(calls.length, 0);
});
test('missing configuration and earlier steps fail without contacting Didit', async () => {
  delete process.env.DIDIT_API_KEY;
  assert.equal((await start()).body.code, 'DIDIT_NOT_CONFIGURED');
  state.users[0].verificationStep = 1;
  assert.equal((await start()).body.code, 'EARLIER_STEPS_REQUIRED');
  assert.equal(calls.length, 0);
});
test('rejects provider redirect outside Didit and sanitizes provider errors', async () => {
  fault = 'redirect'; assert.equal((await start()).body.code, 'DIDIT_INVALID_RESPONSE');
  fault = 'provider'; const result = await start();
  assert.equal(result.status, 503);
  assert.ok(!JSON.stringify(result.body).includes('never-return-me'));
});
test('full approval returns a short-lived proof, without approving the resident', async () => {
  const result = await complete();
  assert.equal(result.status, 200); assert.equal(result.body.status, 'approved');
  const claims = jwt.decode(result.body.verificationProof);
  assert.equal(claims.purpose, 'didit-approved'); assert.equal(claims.exp - claims.iat, 900);
  assert.equal(state.users[0].isVerified, false); assert.equal(uploads.length, 0);
});
for (const status of ['Not Started', 'In Progress', 'In Review', 'Resubmitted', 'Awaiting User']) {
  test(`${status} remains pending and cannot mint proof`, async () => {
    report.status = status; const result = await complete();
    assert.equal(result.status, 202); assert.equal(result.body.verificationProof, undefined);
  });
}
for (const status of ['Declined', 'Expired', 'Abandoned', 'Kyc Expired', 'unknown']) {
  test(`${status} fails closed`, async () => {
    report.status = status; const result = await complete();
    assert.equal(result.status, 422); assert.equal(result.body.verificationProof, undefined);
  });
}
for (const key of ['id_verifications', 'liveness_checks', 'face_matches']) {
  test(`requires a populated, approved ${key} array`, async () => {
    report[key] = []; assert.equal((await complete()).status, 422);
    report[key] = [{ status: 'Declined' }]; assert.equal((await complete()).status, 422);
    report[key] = null; assert.equal((await complete()).status, 422);
  });
}
for (const key of ['session_id', 'workflow_id', 'vendor_data', 'metadata']) {
  test(`rejects mismatched ${key} in provider report`, async () => {
    report[key] = key === 'metadata' ? { profile_id: other } : other;
    assert.equal((await complete()).status, 403);
  });
}
test('rejects sandbox approvals', async () => {
  report.environment = 'sandbox'; assert.equal((await complete()).body.code, 'DIDIT_SANDBOX_RESULT');
});
test('rejects another resident, modified, expired, and legacy tokens', async () => {
  const { body } = await start();
  assert.equal((await call('/identity/complete', { resumeToken: body.resumeToken }, { user: other })).status, 403);
  assert.equal((await call('/identity/complete', { resumeToken: body.resumeToken + 'bad' })).status, 403);
  const payload = jwt.decode(body.resumeToken); delete payload.iat; delete payload.exp;
  const expired = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: -1 });
  assert.equal((await call('/identity/complete', { resumeToken: expired })).status, 403);
  const legacy = jwt.sign({ purpose: 'liveness-passed', sub: uid, sessionId: sid }, process.env.JWT_SECRET);
  assert.equal((await call('/step3', { verificationProof: legacy })).status, 403);
});
test('an application reset or account change invalidates outstanding verification', async () => {
  const { body } = await start();
  state.profiles[0].id = other;
  assert.equal((await call('/identity/complete', { resumeToken: body.resumeToken })).body.code, 'APPLICATION_CHANGED');
  state.profiles[0].id = pid; state.users[0].sessionVersion++;
  assert.equal((await call('/identity/complete', { resumeToken: body.resumeToken })).status, 403);
});
test('submission imports authenticated images and preserves demographics for staff review', async () => {
  const { body } = await complete();
  const result = await call('/step3', { verificationProof: body.verificationProof, idFront: 'https://attacker.example/id', facePhoto: 'https://attacker.example/face', status: 'approved' });
  assert.equal(result.status, 200); assert.equal(uploads.length, 3);
  assert.ok(uploads.every((upload) => upload.url.startsWith('https://media.didit.me/')));
  assert.equal(state.users[0].isVerified, false); assert.equal(state.users[0].verificationStatus, 'pending');
  assert.equal(state.profiles[0].status, 'Pending'); assert.equal(state.profiles[0].fullName, 'QA Resident');
  assert.equal(state.profiles[0].address, 'Existing address'); assert.equal(state.profiles[0].aiVerification.provider, 'didit');
  assert.equal(state.profiles[0].idName, 'QA Resident');
  assert.equal(state.profiles[0].facePhoto, `https://res.cloudinary.com/qa/irequestd/didit/${sid}/selfie.jpg`);
});
test('submission rechecks Didit rather than trusting an earlier proof', async () => {
  const { body } = await complete(); report.status = 'Declined';
  assert.equal((await call('/step3', { verificationProof: body.verificationProof })).status, 422);
  assert.equal(uploads.length, 0); assert.equal(state.users[0].verificationStep, 2);
});
test('retry does not import again or overwrite staff approval', async () => {
  const { body } = await complete();
  assert.equal((await call('/step3', { verificationProof: body.verificationProof })).status, 200);
  state.profiles[0].status = 'approved'; state.users[0].isVerified = true;
  assert.equal((await call('/step3', { verificationProof: body.verificationProof })).status, 200);
  assert.equal(uploads.length, 3); assert.equal(state.profiles[0].status, 'approved');
});
test('DB write failure rolls back resident step/status', async () => {
  const { body } = await complete(); fault = 'profiles';
  assert.equal((await call('/step3', { verificationProof: body.verificationProof })).status, 503);
  assert.equal(state.users[0].verificationStep, 2); assert.equal(state.profiles[0].status, 'submitted');
});
test('media import failure leaves application unsubmitted', async () => {
  const { body } = await complete(); fault = 'media';
  assert.equal((await call('/step3', { verificationProof: body.verificationProof })).status, 503);
  assert.equal(state.users[0].verificationStep, 2);
});
test('only approved provider media hosts may be imported', () => {
  for (const url of ['http://media.didit.me/selfie.jpg', 'https://127.0.0.1/selfie.jpg', 'https://didit.me.attacker.example/selfie.jpg', 'https://secret@media.didit.me/selfie.jpg', 'file:///etc/passwd']) {
    assert.throws(() => didit.mediaUrl(url));
  }
  assert.equal(didit.mediaUrl('https://bucket.s3.eu-west-1.amazonaws.com/id.jpg'), 'https://bucket.s3.eu-west-1.amazonaws.com/id.jpg');
});
test('old Azure routes tell cached clients to refresh', async () => {
  assert.equal((await call('/liveness/session')).status, 409);
  assert.equal((await call('/liveness/complete')).status, 409);
});
