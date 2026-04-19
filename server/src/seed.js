require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('./models/User');

/* ── Staff accounts only ── */
const admins = [
  { fullName: 'Barangay Secretary', email: 'secretary@dologon.gov.ph', password: 'secretary123', role: 'Secretary',         purok: 'Purok 1' },
  { fullName: 'Barangay Collector', email: 'collector@dologon.gov.ph', password: 'collector123', role: 'Collector',         purok: 'Purok 1' },
  { fullName: 'Barangay Captain',   email: 'captain@dologon.gov.ph',   password: 'captain123',   role: 'Barangay Captain', purok: 'Purok 1' },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  for (const admin of admins) {
    const exists = await User.findOne({ email: admin.email });
    if (exists) { console.log(`Skipped (exists): ${admin.email}`); continue; }
    await User.create(admin);
    console.log(`Created: ${admin.role} — ${admin.email}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => { console.error(err); process.exit(1); });
