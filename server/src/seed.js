require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const prisma = require('../lib/prisma');
const { hashPassword } = require('../lib/password');

/* ── Staff accounts only ── */
const admins = [
  { fullName: 'Barangay Secretary', email: 'secretary@dologon.gov.ph', password: 'secretary123', role: 'Secretary',         purok: 'Purok 1' },
  { fullName: 'Barangay Collector', email: 'collector@dologon.gov.ph', password: 'collector123', role: 'Collector',         purok: 'Purok 1' },
  { fullName: 'Barangay Captain',   email: 'captain@dologon.gov.ph',   password: 'captain123',   role: 'Barangay Captain', purok: 'Purok 1' },
];

async function seed() {
  await prisma.$queryRaw`SELECT 1`;
  console.log('Postgres connected');

  for (const admin of admins) {
    const exists = await prisma.admin.findUnique({ where: { email: admin.email } });
    if (exists) { console.log(`Skipped (exists): ${admin.email}`); continue; }
    // The pre('save') hook used to hash this; Prisma has no hooks.
    await prisma.admin.create({
      data: { ...admin, password: await hashPassword(admin.password) },
    });
    console.log(`Created: ${admin.role} — ${admin.email}`);
  }

  await prisma.$disconnect();
  console.log('Done.');
}

seed().catch((err) => { console.error(err); process.exit(1); });
