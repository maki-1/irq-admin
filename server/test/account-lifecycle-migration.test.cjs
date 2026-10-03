// Run the actual migrations and SQL triggers on an isolated PostgreSQL engine.
// PGlite is in-memory; no DATABASE_URL or deployed database is used.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { signToken, verifyToken, requireSession } = require('../lib/accountLifecycle');
process.env.JWT_SECRET = 'isolated-migration-test-secret';
const uid = '11111111-1111-4111-8111-111111111111';
const aid = '22222222-2222-4222-8222-222222222222';
let db;
before(async () => {
  db = new PGlite();
  const root = path.join(__dirname, '../prisma/migrations');
  for (const dir of fs.readdirSync(root).sort()) {
    const file = path.join(root, dir, 'migration.sql');
    if (fs.existsSync(file)) await db.exec(fs.readFileSync(file, 'utf8'));
  }
});
after(async () => { if (db) await db.close(); });
beforeEach(async () => {
  await db.exec('TRUNCATE "users", "admins" CASCADE');
  await db.query('INSERT INTO "users" (id, username, "contactNumber", password, "updatedAt") VALUES ($1, $2, $3, $4, now())', [uid, 'qa-fixture', '09999999999', 'initial-hash']);
  await db.query('INSERT INTO "admins" (id, "fullName", email, password, "updatedAt") VALUES ($1, $2, $3, $4, now())', [aid, 'QA staff', 'qa@example.invalid', 'initial-hash']);
});
const user = async () => (await db.query('SELECT * FROM "users" WHERE id = $1', [uid])).rows[0];
const admin = async () => (await db.query('SELECT * FROM "admins" WHERE id = $1', [aid])).rows[0];
async function recovery() {
  await db.query('UPDATE "users" SET otp = $1, "otpType" = $2, "otpExpires" = now() + interval \'10 minutes\', "resetToken" = $3, "resetTokenExpires" = now() + interval \'15 minutes\' WHERE id = $4', ['123456', 'reset', 'web-reset-fixture', uid]);
  await db.query('INSERT INTO "otp_codes" (id, "userId", code, type, "expiresAt") VALUES ($1, $2, $3, $4, now() + interval \'10 minutes\')', [aid, uid, 'hashed-code', 'reset']);
}
async function assertRecoveryCleared() {
  const row = await user();
  for (const field of ['otp', 'otpExpires', 'otpType', 'resetToken', 'resetTokenExpires']) assert.equal(row[field], null, field);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM "otp_codes"')).rows[0].count, 0);
}
function sessionAllowed(account, token) {
  return requireSession(account, verifyToken(token), { status() { return this; }, json() {} });
}
test('migration adds resident/staff versions with safe defaults', async () => {
  assert.equal((await user()).sessionVersion, 0); assert.equal((await admin()).sessionVersion, 0);
  assert.equal((await user()).active, true); assert.equal((await user()).deletedAt, null);
});
test('direct database deactivation revokes tokens, clears recovery and stays revoked after reactivation', async () => {
  const token = signToken(await user(), 'resident');
  await recovery();
  await db.query('UPDATE "users" SET active = false WHERE id = $1', [uid]);
  assert.equal((await user()).sessionVersion, 1); assert.equal(sessionAllowed(await user(), token), false);
  await assertRecoveryCleared();
  await db.query('UPDATE "users" SET active = true WHERE id = $1', [uid]);
  assert.equal((await user()).sessionVersion, 2); assert.equal(sessionAllowed(await user(), token), false);
  assert.equal(sessionAllowed(await user(), signToken(await user(), 'resident')), true);
});
test('soft deletion revokes access even if a writer leaves active=true', async () => {
  await recovery();
  await db.query('UPDATE "users" SET "deletedAt" = now() WHERE id = $1', [uid]);
  assert.equal((await user()).sessionVersion, 1); await assertRecoveryCleared();
});
test('password changes from another writer revoke resident and staff sessions', async () => {
  await recovery();
  await db.query('UPDATE "users" SET password = $1 WHERE id = $2', ['new-hash', uid]);
  await db.query('UPDATE "admins" SET password = $1 WHERE id = $2', ['new-hash', aid]);
  assert.equal((await user()).sessionVersion, 1); assert.equal((await admin()).sessionVersion, 1);
  await assertRecoveryCleared();
});
test('application version increments and triggers do not double increment', async () => {
  await db.query('UPDATE "users" SET password = $1, "sessionVersion" = "sessionVersion" + 1 WHERE id = $2', ['new-hash', uid]);
  await db.query('UPDATE "admins" SET active = false, "sessionVersion" = "sessionVersion" + 1 WHERE id = $1', [aid]);
  assert.equal((await user()).sessionVersion, 1); assert.equal((await admin()).sessionVersion, 1);
});
test('ordinary profile updates leave valid sessions and recovery codes intact', async () => {
  await recovery();
  await db.query('UPDATE "users" SET avatar = $1 WHERE id = $2', ['test-avatar', uid]);
  assert.equal((await user()).sessionVersion, 0); assert.equal((await user()).otp, '123456');
});
test('abandoned registration can replace its password and receive a fresh verification code', async () => {
  await recovery();
  await db.query('UPDATE "users" SET password = $1, otp = $2, "otpType" = $3 WHERE id = $4', ['new-hash', '654321', 'verification', uid]);
  const row = await user();
  assert.equal(row.sessionVersion, 1); assert.equal(row.otp, '654321'); assert.equal(row.otpType, 'verification'); assert.equal(row.resetToken, null);
});
test('a reset compare-and-swap can change the password only once', async () => {
  const sql = 'UPDATE "users" SET password = $1, "sessionVersion" = "sessionVersion" + 1 WHERE id = $2 AND active = true AND "deletedAt" IS NULL AND "sessionVersion" = 0 RETURNING id';
  const results = await Promise.all([db.query(sql, ['first-hash', uid]), db.query(sql, ['second-hash', uid])]);
  assert.equal(results.reduce((sum, result) => sum + result.rows.length, 0), 1);
  assert.equal((await user()).sessionVersion, 1);
});
