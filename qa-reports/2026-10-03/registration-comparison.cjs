// Audit observations, not acceptance tests: these checks intentionally reproduce
// existing differences. Real handlers, isolated database/upload/delivery doubles.
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../server');
const mobile = process.env.MOBILE_BACKEND_DIR || 'D:/irequestd/backend';
const serverRequire = createRequire(path.join(root, 'package.json'));
const express = serverRequire('express');
const multer = serverRequire('multer');
const bcrypt = serverRequire('bcryptjs');
const jwt = serverRequire('jsonwebtoken');
process.env.JWT_SECRET = 'isolated-registration-audit-secret';
process.env.LIVENESS_SESSION_SECRET = process.env.JWT_SECRET;
let users, profiles, otps, sent, failSms, failEmail;
const observations = [];
const uid = '11111111-1111-4111-8111-111111111111';
const password = 'Registration-QA-123!';
const copy = (x) => x == null ? x : structuredClone(x);
function matches(row, where = {}) {
  return row && Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some((part) => matches(row, part));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('gt' in value) return row[key] > value.gt;
    }
    return row[key] === value;
  });
}
function model(rows, kind) {
  const result = (row, select, include) => {
    if (!row) return null;
    if (select) return Object.fromEntries(Object.keys(select).map((key) => [key, copy(row[key])]));
    return { ...copy(row), ...(include?.verificationProfile ? { verificationProfile: copy(profiles.find((p) => p.userId === row.id) || null) } : {}) };
  };
  function unique(data, ignore) {
    if (kind !== 'user') return;
    for (const key of ['username', 'email', 'contactNumber']) {
      if (data[key] != null && rows().some((r) => r !== ignore && r[key] === data[key])) throw Object.assign(new Error('Unique constraint: ' + key), { code: 'P2002', meta: { target: [key] } });
    }
  }
  const apply = (row, data) => {
    unique(data, row);
    for (const [key, value] of Object.entries(data)) row[key] = value && typeof value === 'object' && 'increment' in value ? (row[key] || 0) + value.increment : copy(value);
  };
  const methods = {
    findUnique: async ({ where, select, include }) => result(rows().find((r) => matches(r, where)), select, include),
    findFirst: async ({ where, select }) => result([...rows()].reverse().find((r) => matches(r, where)), select),
    findMany: async ({ where } = {}) => copy(rows().filter((r) => matches(r, where))),
    count: async ({ where } = {}) => rows().filter((r) => matches(r, where)).length,
    create: async ({ data }) => {
      unique(data);
      const defaults = kind === 'user' ? { active: true, deletedAt: null, sessionVersion: 0, contactVerified: false, isVerified: false, verificationStep: 0, verificationStatus: null, otpAttempts: 0 }
        : kind === 'profile' ? { status: 'draft', currentStep: 1, remarks: null, rejectionReason: null } : { used: false };
      const row = { id: crypto.randomUUID(), createdAt: new Date(), ...defaults, ...copy(data) };
      rows().push(row); return copy(row);
    },
    update: async ({ where, data, select }) => {
      const row = rows().find((r) => matches(r, where));
      if (!row) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
      apply(row, data); return result(row, select);
    },
    updateMany: async ({ where, data }) => { const found = rows().filter((r) => matches(r, where)); found.forEach((row) => apply(row, data)); return { count: found.length }; },
    deleteMany: async ({ where }) => {
      let count = 0;
      for (let i = rows().length - 1; i >= 0; i--) if (matches(rows()[i], where)) { rows().splice(i, 1); count++; }
      return { count };
    },
    upsert: async ({ where, create, update }) => rows().some((r) => matches(r, where)) ? methods.update({ where, data: update }) : methods.create({ data: create }),
  };
  return methods;
}
const db = { user: model(() => users, 'user'), verificationProfile: model(() => profiles, 'profile'), otpCode: model(() => otps, 'otp'), request: { count: async () => 0 } };
let queue = Promise.resolve();
db.$transaction = (action) => {
  const work = queue.then(async () => {
    const snapshot = copy({ users, profiles, otps });
    try { return typeof action === 'function' ? await action(db) : await Promise.all(action); }
    catch (error) { ({ users, profiles, otps } = snapshot); throw error; }
  });
  queue = work.catch(() => {}); return work;
};
function stub(file, exports) { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports }; }
function delivery(channel, code) {
  if (channel === 'sms' ? failSms : failEmail) throw new Error('Synthetic delivery failure');
  sent.push({ channel, code });
}
const memoryUpload = multer({ storage: multer.memoryStorage() });
const mobileUpload = Object.fromEntries(['single', 'fields'].map((method) => [method, (...args) => {
  const middleware = memoryUpload[method](...args);
  return (req, res, next) => middleware(req, res, (error) => {
    for (const file of [req.file, ...Object.values(req.files || {}).flat()].filter(Boolean)) file.path = 'https://qa.invalid/' + file.originalname;
    next(error);
  });
}]));
stub(path.join(root, 'lib/prisma.js'), db);
stub(path.join(root, 'src/config/cloudinary.js'), { uploader: { upload_stream: (_opts, callback) => ({ end: () => callback(null, { secure_url: 'https://qa.invalid/upload.png' }) }) } });
stub(path.join(root, 'src/utils/sendSms.js'), async ({ message }) => delivery('sms', message.match(/\b\d{6}\b/)[0]));
stub(path.join(root, 'src/utils/sendEmail.js'), async ({ html }) => delivery('email', html.match(/\b\d{6}\b/)[0]));
stub(path.join(root, 'lib/purokFee.js'), { listPuroks: async () => ['Purok 1'], isKnownPurok: async (p) => p === 'Purok 1' });
stub(path.join(root, 'src/utils/groqVerify.js'), { verifyIdentity: async () => ({ mocked: true }) });
stub(path.join(root, 'src/utils/azureFaceVerify.js'), { azureVerifyIdentity: async () => ({ mocked: true }) });
stub(path.join(root, 'src/utils/azureLiveness.js'), {});
stub(path.join(mobile, 'lib/prisma.js'), db);
stub(path.join(mobile, 'lib/purokFee.js'), { listPuroks: async () => ['Purok 1'], isKnownPurok: async (p) => p === 'Purok 1' });
stub(path.join(mobile, 'services/sms.js'), { sendOtp: async (_contact, code) => delivery('sms', code), sendPasswordResetOtp: async (_contact, code) => delivery('sms', code) });
stub(path.join(mobile, 'services/email.js'), { sendOtpEmail: async (_email, code) => delivery('email', code) });
stub(path.join(mobile, 'config/cloudinary.js'), { uploadAvatar: mobileUpload, uploadIdDoc: mobileUpload, uploadFace: mobileUpload, uploadFreeProof: mobileUpload });
const app = express(); app.use(express.json());
const auth = require(path.join(root, 'src/controllers/resident.auth.controller'));
for (const [url, handler] of [['register', 'register'], ['verify-otp', 'verifyOtp'], ['resend-otp', 'resendOtp'], ['login', 'residentLogin']]) app.post('/web/auth/' + url, auth[handler]);
for (const [url, handler] of [['check-username', 'checkUsername'], ['check-contact', 'checkContact'], ['check-email', 'checkEmail']]) app.get('/web/auth/' + url, auth[handler]);
const { residentProtect } = require(path.join(root, 'src/middleware/residentAuth'));
app.get('/web/auth/me', residentProtect, auth.getMe);
const verification = require(path.join(root, 'src/controllers/resident.verification.controller'));
for (const step of ['step1', 'step2', 'step3']) app.post('/web/verification/' + step, residentProtect, memoryUpload.fields([{ name: 'idFront' }, { name: 'idBack' }, { name: 'facePhoto' }, { name: 'secondaryIdFront' }, { name: 'secondaryId2Front' }]), verification[step]);
app.get('/web/verification/status', residentProtect, verification.getStatus);
app.use('/mobile/auth', require(path.join(mobile, 'routes/auth')));
app.use('/mobile/verification', require(path.join(mobile, 'routes/verification')));
const policy = require(path.join(root, 'lib/accountLifecycle'));
let server, base;
function reset() { users = []; profiles = []; otps = []; sent = []; failSms = false; failEmail = false; }
async function fixture(withProfile = true) {
  reset();
  const user = await db.user.create({ data: { id: uid, username: 'qa_resident', contactNumber: '09999999999', password: bcrypt.hashSync(password, 4), contactVerified: true } });
  if (withProfile) await db.verificationProfile.create({ data: { userId: uid, fullName: 'QA Resident', currentStep: 2 } });
  return policy.signToken(user, 'resident');
}
async function call(url, body, token) {
  const multipart = body instanceof FormData;
  const response = await fetch(base + url, { method: body === undefined ? 'GET' : 'POST', headers: { ...(!multipart ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : multipart ? body : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const signup = (extra = {}) => ({ username: 'qa_resident', contactNumber: '09999999999', password, confirmPassword: password, ...extra });
const verifyBody = (backend, userId, code) => backend === 'web' ? { userId, otp: code } : { userId, code, type: 'register' };
function upload(body, fields) {
  const form = new FormData(); for (const [key, value] of Object.entries(body)) form.set(key, value);
  for (const field of fields) form.set(field, new Blob(['synthetic image bytes'], { type: 'image/png' }), field + '.png');
  return form;
}
async function observe(name, run) {
  const details = await run(); observations.push({ name, reproduced: true, ...details });
  process.stdout.write('CONFIRMED ' + name + '\n');
}
async function main() {
  server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve)); base = 'http://127.0.0.1:' + server.address().port;
  // Do not print OTPs or delivery logs from the handlers, even for synthetic data.
  const oldLog = console.log, oldError = console.error; console.log = () => {}; console.error = () => {};
  try {
    await observe('Successful registration and OTP set different isVerified meanings', async () => {
      const result = {};
      for (const backend of ['web', 'mobile']) {
        reset(); const created = await call('/' + backend + '/auth/register', signup()); assert.equal(created.status, 201);
        const verified = await call('/' + backend + '/auth/verify-otp', verifyBody(backend, created.body.userId, sent.at(-1).code)); assert.equal(verified.status, 200);
        result[backend] = { contactVerified: users[0].contactVerified, isVerified: verified.body.user.isVerified, profileExists: profiles.length > 0 };
      }
      assert.equal(result.web.isVerified, false); assert.equal(result.mobile.isVerified, true); return result;
    });
    for (const [name, data, expected] of [
      ['One-character password', { password: 'x', confirmPassword: 'x' }, [201, 400]],
      ['Digits-only eight-character password', { password: '12345678', confirmPassword: '12345678' }, [201, 201]],
      ['Invalid contact number', { contactNumber: '123' }, [400, 201]],
      ['Username outside both UI rules', { username: 'a' }, [201, 201]],
      ['Malformed email', { email: 'not-an-email' }, [201, 201]],
      ['Web registration payload without confirmPassword', { confirmPassword: undefined }, [201, 400]],
    ]) await observe(name, async () => {
      const statuses = [];
      for (const backend of ['web', 'mobile']) { reset(); statuses.push((await call('/' + backend + '/auth/register', signup(data))).status); }
      assert.deepEqual(statuses, expected); return { web: statuses[0], mobile: statuses[1] };
    });
    await observe('Failed OTP delivery reports success only on mobile', async () => {
      const result = {};
      for (const backend of ['web', 'mobile']) { reset(); failSms = true; failEmail = true; result[backend] = (await call('/' + backend + '/auth/register', signup())).status; }
      assert.deepEqual(result, { web: 502, mobile: 201 }); return result;
    });
    await observe('Email fallback exists only on web', async () => {
      const result = {};
      for (const backend of ['web', 'mobile']) { reset(); failSms = true; const reply = await call('/' + backend + '/auth/register', signup({ email: 'qa@example.invalid' })); result[backend] = { status: reply.status, deliveries: sent.map((s) => s.channel), channel: reply.body.channel || null }; }
      assert.deepEqual(result.web.deliveries, ['email']); assert.deepEqual(result.mobile.deliveries, []); return result;
    });
    await observe('Retrying an abandoned registration differs', async () => {
      const result = {};
      for (const backend of ['web', 'mobile']) { reset(); await call('/' + backend + '/auth/register', signup()); const available = await call('/' + backend + '/auth/check-username?username=qa_resident'); const retry = await call('/' + backend + '/auth/register', signup()); result[backend] = { available: available.body.available, retryStatus: retry.status }; }
      assert.deepEqual(result, { web: { available: true, retryStatus: 201 }, mobile: { available: false, retryStatus: 409 } }); return result;
    });
    await observe('OTP guesses are capped only on web', async () => {
      const result = {};
      for (const backend of ['web', 'mobile']) {
        reset(); const created = await call('/' + backend + '/auth/register', signup()); const code = sent.at(-1).code;
        const statuses = []; for (let i = 0; i < 6; i++) statuses.push((await call('/' + backend + '/auth/verify-otp', verifyBody(backend, created.body.userId, '000000'))).status);
        const valid = await call('/' + backend + '/auth/verify-otp', verifyBody(backend, created.body.userId, code)); result[backend] = { wrongAttemptStatuses: statuses, correctCodeAfterSixFailures: valid.status };
      }
      assert.ok(result.web.wrongAttemptStatuses.includes(429)); assert.notEqual(result.web.correctCodeAfterSixFailures, 200); assert.equal(result.mobile.correctCodeAfterSixFailures, 200); return result;
    });
    await observe('An OTP issued by one backend cannot be verified by the other', async () => {
      const result = {};
      for (const [source, target] of [['web', 'mobile'], ['mobile', 'web']]) { reset(); const created = await call('/' + source + '/auth/register', signup()); const reply = await call('/' + target + '/auth/verify-otp', verifyBody(target, created.body.userId, sent.at(-1).code)); assert.equal(reply.status, 400); result[source + 'To' + target] = reply.status; }
      return result;
    });
    await observe('Resending in the other channel does not invalidate the original OTP', async () => {
      reset(); const created = await call('/web/auth/register', signup()); const code = sent.at(-1).code;
      assert.equal((await call('/mobile/auth/resend-otp', { userId: created.body.userId, type: 'register' })).status, 200);
      const old = await call('/web/auth/verify-otp', verifyBody('web', created.body.userId, code)); assert.equal(old.status, 200);
      return { oldWebCodeStatus: old.status, unusedMobileChallenges: otps.filter((o) => !o.used).length };
    });
    await observe('Verified registrations can be used for login on both services', async () => {
      const result = {};
      for (const source of ['web', 'mobile']) {
        reset(); const created = await call('/' + source + '/auth/register', signup()); await call('/' + source + '/auth/verify-otp', verifyBody(source, created.body.userId, sent.at(-1).code));
        result[source] = {};
        for (const target of ['web', 'mobile']) { const reply = await call('/' + target + '/auth/login', { username: 'qa_resident', password }); assert.equal(reply.status, 200); result[source][target] = reply.status; }
      }
      return result;
    });
    await observe('Blank education is accepted only by mobile and marks review pending before ID submission', async () => {
      const result = {};
      for (const backend of ['web', 'mobile']) { const token = await fixture(); const reply = await call('/' + backend + '/verification/step2', {}, token); result[backend] = { http: reply.status, profileStatus: profiles[0].status, currentStep: profiles[0].currentStep, hasId: !!profiles[0].idFront }; }
      assert.equal(result.web.http, 400); assert.deepEqual(result.mobile, { http: 200, profileStatus: 'pending', currentStep: 3, hasId: false }); return result;
    });
    for (const [name, fields, expectedWeb] of [['ID submission without face photo', ['idFront', 'idBack'], 400], ['ID submission without server liveness proof', ['idFront', 'idBack', 'facePhoto'], 403]]) {
      await observe(name, async () => {
        const result = {};
        for (const backend of ['web', 'mobile']) { const token = await fixture(); const reply = await call('/' + backend + '/verification/step3', upload({ idType: 'primary', idName: 'National ID' }, fields), token); result[backend] = reply.status; }
        assert.deepEqual(result, { web: expectedWeb, mobile: 200 }); return result;
      });
    }
    await observe('Education can skip demographics only through the web endpoint', async () => {
      const result = {};
      for (const backend of ['web', 'mobile']) { const token = await fixture(false); const reply = await call('/' + backend + '/verification/step2', backend === 'web' ? { educationLevel: 'High School', schoolName: 'QA School', graduationYear: '2020' } : { educationLevel: 'High School', school: 'QA School', yearGraduated: '2020' }, token); result[backend] = reply.status; }
      assert.deepEqual(result, { web: 200, mobile: 400 }); return result;
    });
    await observe('Web secondary-only ID payload is rejected by its own backend', async () => {
      const token = await fixture();
      const proof = jwt.sign({ purpose: 'liveness-passed', sub: uid }, process.env.LIVENESS_SESSION_SECRET, { expiresIn: '10m' });
      // The web form sends secondaryIdFront/secondaryId2Front but no idFront.
      const reply = await call('/web/verification/step3', upload({ idType: 'Secondary IDs', idName: 'Secondary IDs', livenessProof: proof, secondaryIdType: 'School ID', secondaryIdName: 'School ID', secondaryId2Type: 'Birth Certificate', secondaryId2Name: 'Birth Certificate' }, ['facePhoto', 'secondaryIdFront', 'secondaryId2Front']), token);
      assert.equal(reply.status, 400); assert.match(reply.body.message, /Primary ID type and front photo/);
      return { status: reply.status, message: reply.body.message };
    });
    await observe('Step-one progress is written to different fields and returned inconsistently across channels', async () => {
      const result = {};
      for (const source of ['web', 'mobile']) {
        const token = await fixture(false);
        const body = source === 'web' ? { firstName: 'QA', lastName: 'Resident', birthday: '2000-01-01', gender: 'Female', purok: 'Purok 1', street: 'Purok 1', barangay: 'Dologon', city: 'Maramag', yearsAtAddress: '5', age: 26 }
          : { fullName: 'QA Resident', address: 'Purok 1, Dologon', birthday: '2000-01-01', sex: 'Female', purok: 'Purok 1', indigent: 'No', yearsOfResidency: '5', motherName: 'QA Mother', fatherName: 'QA Father' };
        const saved = await call('/' + source + '/verification/step1', body, token); assert.equal(saved.status, 200);
        const web = await call('/web/auth/me', undefined, token), app = await call('/mobile/auth/me', undefined, token);
        result[source] = { webStep: web.body.verificationStep, mobileStep: app.body.verificationStep, profileStatus: profiles[0].status, yearsAtAddress: profiles[0].yearsAtAddress ?? null, yearsOfResidency: profiles[0].yearsOfResidency ?? null };
      }
      assert.equal(result.web.webStep, 1); assert.equal(result.web.mobileStep, 1); assert.equal(result.mobile.webStep, 0); assert.equal(result.mobile.mobileStep, 2); return result;
    });
    await observe('The app demographic payload omits the required purok field', async () => {
      const token = await fixture(false);
      // Mirrors DemographicScreen: purok is embedded in address but not sent
      // as a separate field. ApiService forwards this map unchanged.
      const reply = await call('/mobile/verification/step1', { fullName: 'QA Resident', address: 'Purok 1, Brgy. Dologon, Maramag, Bukidnon', birthday: '2000-01-01', sex: 'Female', yearsOfResidency: '5', motherName: 'QA Mother', fatherName: 'QA Father', indigent: 'No', isPwd: false }, token);
      assert.equal(reply.status, 400); assert.equal(reply.body.message, 'Please select your purok');
      return { status: reply.status, message: reply.body.message, savedProfiles: profiles.length };
    });
  } finally {
    console.log = oldLog; console.error = oldError;
    fs.writeFileSync(path.join(__dirname, 'registration-comparison-results.json'), JSON.stringify({ mode: 'Local real HTTP handlers; shared in-memory database, synthetic uploads, intercepted delivery and AI services; no live providers or accounts', observations }, null, 2));
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
