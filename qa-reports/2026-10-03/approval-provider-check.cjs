// Read-only diagnostics. NEVER sends an SMS/email or changes database rows.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const req = createRequire(path.join(root, 'server/package.json'));
const dotenv = req('dotenv');
const axios = req('axios');
const { Client } = req('pg');
const envs = [
  ['web', path.join(root, 'server')],
  ['mobile', process.env.MOBILE_BACKEND_DIR || 'D:/irequestd/backend'],
].map(([name, dir]) => ({ name, dir, env: dotenv.parse(fs.readFileSync(path.join(dir, '.env'))) }));
const safeError = (e) => ({ code: e.code || 'ERROR', httpStatus: e.response?.status || null, smtpStatus: e.responseCode || null });
async function check({ name, dir, env }) {
  const result = { name, checkedAt: new Date().toISOString(), config: Object.fromEntries(['UNISMS_API_KEY', 'UNISMS_SENDER_ID', 'EMAIL_USER', 'EMAIL_PASS', 'APPROVE_LINK_SECRET', 'PORTAL_URL'].map(k => [k, Boolean(env[k])])) };
  const portal = env.PORTAL_URL || (env.CLIENT_URL || '').split(',')[0].trim() || 'http://localhost:5173';
  try { result.approvalPortalOrigin = new URL(portal).origin; } catch { result.approvalPortalOrigin = 'INVALID'; }
  await Promise.all([
    (async () => {
      try {
        const { data, status } = await axios.get('https://unismsapi.com/api/account', { auth: { username: env.UNISMS_API_KEY, password: '' }, timeout: 15000, maxRedirects: 0 });
        result.smsAccount = { httpStatus: status, accountStatus: data.status, smsCredits: data.sms_credits, sidTokens: data.sid_tokens };
      } catch (e) { result.smsAccount = safeError(e); }
    })(),
    (async () => {
      const mailer = createRequire(path.join(dir, 'package.json'))('nodemailer');
      const transporter = mailer.createTransport({ ...(name === 'web' ? { service: 'gmail' } : { host: 'smtp.gmail.com', port: 465, secure: true }), auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS }, connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 12000 });
      try { result.smtpAuthentication = { verified: await transporter.verify(), emailSent: false }; }
      catch (e) { result.smtpAuthentication = { verified: false, ...safeError(e) }; }
      finally { transporter.close(); }
    })(),
    (async () => {
      const db = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 12000, statement_timeout: 12000 });
      try {
        await db.connect(); await db.query('BEGIN READ ONLY');
        const { rows } = await db.query('SELECT active, "contactNumber", "notifyEmail" FROM admins WHERE role = $1 AND lower(trim(purok)) = $2', ['Purok Leader', 'purok 10']);
        result.purok10 = { leaderCount: rows.length, leaders: rows.map(r => ({ active: r.active, phoneConfigured: Boolean(r.contactNumber), phoneLast4: r.contactNumber ? String(r.contactNumber).slice(-4) : null, notifyEmailConfigured: Boolean(r.notifyEmail), notifyEmailDomain: r.notifyEmail?.split('@')[1] || null })) };
        const { rows: columns } = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'admins' AND column_name = 'sessionVersion'");
        result.staffSessionVersionColumn = columns.length === 1;
        await db.query('ROLLBACK');
        const localReq = createRequire(path.join(dir, 'package.json'));
        const { PrismaClient } = localReq('@prisma/client');
        const { PrismaPg } = localReq('@prisma/adapter-pg');
        const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL, max: 1, connectionTimeoutMillis: 12000, statement_timeout: 12000, options: '-c default_transaction_read_only=on' }), log: [] });
        try {
          const leader = await prisma.admin.findFirst({ where: { role: 'Purok Leader', ...(name === 'web' ? { active: true } : {}), purok: { equals: 'Purok 10', mode: 'insensitive' } } });
          result.actualPrismaLeaderLookup = { succeeded: true, found: Boolean(leader), selectedHasNotifyEmail: Boolean(leader?.notifyEmail) };
        } catch (e) { result.actualPrismaLeaderLookup = { succeeded: false, code: e.code || 'ERROR' }; }
        finally { await prisma.$disconnect(); }
      } catch (e) { result.database = safeError(e); }
      finally { await db.end().catch(() => {}); }
    })(),
  ]);
  return result;
}
Promise.all(envs.map(check)).then(results => {
  const report = { checkedAt: new Date().toISOString(), messageSends: 0, databaseWrites: 0, scope: 'Local .env credentials; does not establish deployed host configuration or inbox/handset delivery.', smsApiDocs: 'https://unismsapi.com/docs/sms', results };
  fs.writeFileSync(path.join(__dirname, 'approval-provider-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}).catch(e => { console.error(safeError(e)); process.exitCode = 1; });
