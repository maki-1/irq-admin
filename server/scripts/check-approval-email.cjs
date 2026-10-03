// Read-only readiness check: SMTP authentication, link configuration and schema.
// Does not send mail, generate a real staff link, or modify the database.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { verifyEmailConnection } = require('../lib/emailDelivery');
const { portalUrl } = require('../lib/approveLink');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const result = {
    checkedAt: new Date().toISOString(),
    portal: portalUrl({ ...process.env, NODE_ENV: 'production' }),
    signingSecretConfigured: Boolean(process.env.APPROVE_LINK_SECRET),
    messagesSent: 0,
  };
  const checks = await Promise.allSettled([
    verifyEmailConnection(),
    (async () => {
      if (!process.env.DATABASE_URL) throw Object.assign(new Error('Missing database configuration'), { code: 'DATABASE_CONFIG' });
      const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000, statement_timeout: 10000, options: '-c default_transaction_read_only=on' }), log: [] });
      try { await db.admin.findFirst({ select: { id: true, sessionVersion: true }, where: { role: 'Purok Leader', active: true } }); return true; }
      finally { await db.$disconnect(); }
    })(),
  ]);
  for (const [index, name] of ['smtp', 'databaseSchema'].entries()) {
    const check = checks[index];
    result[name] = check.status === 'fulfilled' ? { ok: true } : { ok: false, code: check.reason.code || 'CHECK_FAILED', ...(check.reason.responseCode ? { smtpStatus: check.reason.responseCode } : {}) };
  }
  result.ready = Boolean(result.portal && result.signingSecretConfigured && result.smtp.ok && result.databaseSchema.ok);
  if (result.databaseSchema.code === 'P2022') result.nextStep = 'Apply the pending main-repository lifecycle migrations during the coordinated backend rollout.';
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ready ? 0 : 1;
}
main().catch(() => { console.error('Approval email readiness check could not run.'); process.exitCode = 1; });
