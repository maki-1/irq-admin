require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('./models/User');
const Document = require('./models/Document');
const VerificationProfile = require('./models/VerificationProfile');

/* ── Staff accounts ── */
const admins = [
  { fullName: 'Barangay Secretary', email: 'secretary@dologon.gov.ph', password: 'secretary123', role: 'Secretary',         purok: 'Purok 1' },
  { fullName: 'Barangay Collector', email: 'collector@dologon.gov.ph', password: 'collector123', role: 'Collector',         purok: 'Purok 1' },
  { fullName: 'Barangay Captain',   email: 'captain@dologon.gov.ph',   password: 'captain123',   role: 'Barangay Captain', purok: 'Purok 1' },
];

/* ── Sample document requests ── */
const sampleDocs = [
  { fullName: 'Fhovie Alivio',    age: 28, gender: 'Female', purok: 'P-12 Dologon', contactNumber: '09171234501', documentType: 'Certificate of Indigency',  status: 'Pending',    paymentStatus: 'Pending',              purpose: 'Financial Assistance' },
  { fullName: 'Gerald Anderson',  age: 34, gender: 'Male',   purok: 'P-4 Dologon',  contactNumber: '09171234502', documentType: 'Barangay Clearance',          status: 'Pending',    paymentStatus: 'Paid',                 purpose: 'Employment' },
  { fullName: 'Ann Curtis',       age: 22, gender: 'Female', purok: 'P-21 Dologon', contactNumber: '09171234503', documentType: 'Certificate of Residency',    status: 'Pending',    paymentStatus: 'Pending',              purpose: 'School Requirement' },
  { fullName: 'Jezreel Yanson',   age: 45, gender: 'Male',   purok: 'P-13 Dologon', contactNumber: '09171234504', documentType: 'Certificate of Indigency',  status: 'Processing', paymentStatus: 'Pending Verification', purpose: 'Government ID' },
  { fullName: 'Mark Zuckerberg',  age: 39, gender: 'Male',   purok: 'P-4 Dologon',  contactNumber: '09171234505', documentType: 'Barangay Clearance',          status: 'Processing', paymentStatus: 'Paid',                 purpose: 'Business Permit' },
  { fullName: 'John Doe',         age: 31, gender: 'Male',   purok: 'P-3 Dologon',  contactNumber: '09171234506', documentType: 'Certificate of Residency',    status: 'Printing',   paymentStatus: 'Paid',                 purpose: 'Loan Application' },
  { fullName: 'Maria Santos',     age: 27, gender: 'Female', purok: 'P-7 Dologon',  contactNumber: '09171234507', documentType: 'Barangay Clearance',          status: 'Completed',  paymentStatus: 'Paid',                 purpose: 'Employment' },
  { fullName: 'Jose Reyes',       age: 52, gender: 'Male',   purok: 'P-2 Dologon',  contactNumber: '09171234508', documentType: 'Certificate of Indigency',  status: 'Completed',  paymentStatus: 'Exempt',               purpose: 'Senior Benefit' },
  { fullName: 'Luisa Dela Cruz',  age: 19, gender: 'Female', purok: 'P-9 Dologon',  contactNumber: '09171234509', documentType: 'Certificate of Residency',    status: 'Completed',  paymentStatus: 'Paid',                 purpose: 'College Admission' },
  { fullName: 'Ramon Garcia',     age: 41, gender: 'Male',   purok: 'P-5 Dologon',  contactNumber: '09171234510', documentType: 'Barangay Clearance',          status: 'Completed',  paymentStatus: 'Paid',                 purpose: 'Passport Application' },
  { fullName: 'Elena Bautista',   age: 36, gender: 'Female', purok: 'P-6 Dologon',  contactNumber: '09171234511', documentType: 'Certificate of Indigency',  status: 'Completed',  paymentStatus: 'Exempt',               purpose: 'Medical Assistance' },
  { fullName: 'Pedro Villanueva', age: 60, gender: 'Male',   purok: 'P-11 Dologon', contactNumber: '09171234512', documentType: 'Barangay Clearance',          status: 'Completed',  paymentStatus: 'Exempt',               purpose: 'Senior Citizen ID' },
  { fullName: 'Rosa Mendoza',     age: 24, gender: 'Female', purok: 'P-8 Dologon',  contactNumber: '09171234513', documentType: 'Certificate of Residency',    status: 'Rejected',   paymentStatus: 'Pending',              purpose: 'Employment' },
  { fullName: 'Arturo Enriquez',  age: 47, gender: 'Male',   purok: 'P-10 Dologon', contactNumber: '09171234514', documentType: 'Barangay Clearance',          status: 'Pending',    paymentStatus: 'Pending',              purpose: 'NBI Clearance' },
  { fullName: 'Carla Morales',    age: 33, gender: 'Female', purok: 'P-14 Dologon', contactNumber: '09171234515', documentType: 'Certificate of Indigency',  status: 'Pending',    paymentStatus: 'Pending',              purpose: 'Social Welfare' },
  { fullName: 'Danilo Torres',    age: 29, gender: 'Male',   purok: 'P-1 Dologon',  contactNumber: '09171234516', documentType: 'Certificate of Residency',    status: 'Processing', paymentStatus: 'Pending Verification', purpose: 'Voter Registration' },
  { fullName: 'Gina Castillo',    age: 55, gender: 'Female', purok: 'P-16 Dologon', contactNumber: '09171234517', documentType: 'Barangay Clearance',          status: 'Printing',   paymentStatus: 'Paid',                 purpose: 'Real Estate' },
  { fullName: 'Ben Aquino',       age: 38, gender: 'Male',   purok: 'P-15 Dologon', contactNumber: '09171234518', documentType: 'Certificate of Indigency',  status: 'Completed',  paymentStatus: 'Exempt',               purpose: 'PWD Assistance' },
  { fullName: 'Nora Fernandez',   age: 43, gender: 'Female', purok: 'P-17 Dologon', contactNumber: '09171234519', documentType: 'Certificate of Residency',    status: 'Pending',    paymentStatus: 'Pending',              purpose: 'Bank Account' },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  /* Staff */
  for (const admin of admins) {
    const exists = await User.findOne({ email: admin.email });
    if (exists) { console.log(`Skipped (exists): ${admin.email}`); continue; }
    await User.create(admin);
    console.log(`Created: ${admin.role} — ${admin.email}`);
  }

  /* Documents */
  const existingDocs = await Document.countDocuments();
  if (existingDocs > 0) {
    console.log(`Skipped documents (${existingDocs} already exist).`);
  } else {
    for (const doc of sampleDocs) {
      await Document.create(doc);
      console.log(`Created document: ${doc.fullName} — ${doc.documentType} [${doc.status}]`);
    }
  }

  /* Verification Profiles */
  const existingVerif = await VerificationProfile.countDocuments();
  if (existingVerif > 0) {
    console.log(`Skipped verification profiles (${existingVerif} already exist).`);
  } else {
    const profiles = [
      { fullName: 'Fhovie Alivio',    purok: 'P-12 Dologon', email: 'fhovie@email.com',    contactNumber: '09171234501', gender: 'Female', dateOfBirth: new Date('1996-03-14'), civilStatus: 'Single',   occupation: 'Student',           status: 'Pending' },
      { fullName: 'Gerald Anderson',  purok: 'P-4 Dologon',  email: 'gerald@email.com',   contactNumber: '09171234502', gender: 'Male',   dateOfBirth: new Date('1990-07-22'), civilStatus: 'Married',  occupation: 'Farmer',            status: 'Pending' },
      { fullName: 'Ann Curtis',       purok: 'P-21 Dologon', email: 'ann@email.com',      contactNumber: '09171234503', gender: 'Female', dateOfBirth: new Date('2002-11-05'), civilStatus: 'Single',   occupation: 'Student',           status: 'Under Review' },
      { fullName: 'Jezreel Yanson',   purok: 'P-13 Dologon', email: 'jezreel@email.com',  contactNumber: '09171234504', gender: 'Male',   dateOfBirth: new Date('1979-01-30'), civilStatus: 'Married',  occupation: 'Tricycle Driver',   status: 'Verified',    remarks: 'All documents valid.' },
      { fullName: 'Mark Zuckerberg',  purok: 'P-4 Dologon',  email: 'mark@email.com',     contactNumber: '09171234505', gender: 'Male',   dateOfBirth: new Date('1985-05-14'), civilStatus: 'Married',  occupation: 'Business Owner',    status: 'Verified',    remarks: 'Verified with valid ID.' },
      { fullName: 'John Doe',         purok: 'P-3 Dologon',  email: 'john@email.com',     contactNumber: '09171234506', gender: 'Male',   dateOfBirth: new Date('1993-08-19'), civilStatus: 'Single',   occupation: 'Carpenter',         status: 'Rejected',    remarks: 'Incomplete documents submitted.' },
      { fullName: 'Maria Santos',     purok: 'P-7 Dologon',  email: 'maria@email.com',    contactNumber: '09171234507', gender: 'Female', dateOfBirth: new Date('1997-04-02'), civilStatus: 'Single',   occupation: 'Teacher',           status: 'Pending' },
      { fullName: 'Jose Reyes',       purok: 'P-2 Dologon',  email: 'jose@email.com',     contactNumber: '09171234508', gender: 'Male',   dateOfBirth: new Date('1964-12-11'), civilStatus: 'Widowed',  occupation: 'Retired',           status: 'Verified',    remarks: 'Senior citizen. Documents complete.' },
      { fullName: 'Luisa Dela Cruz',  purok: 'P-9 Dologon',  email: 'luisa@email.com',    contactNumber: '09171234509', gender: 'Female', dateOfBirth: new Date('2005-06-25'), civilStatus: 'Single',   occupation: 'Student',           status: 'Pending' },
      { fullName: 'Ramon Garcia',     purok: 'P-5 Dologon',  email: 'ramon@email.com',    contactNumber: '09171234510', gender: 'Male',   dateOfBirth: new Date('1983-09-17'), civilStatus: 'Married',  occupation: 'Electrician',       status: 'Under Review' },
      { fullName: 'Elena Bautista',   purok: 'P-6 Dologon',  email: 'elena@email.com',    contactNumber: '09171234511', gender: 'Female', dateOfBirth: new Date('1988-02-28'), civilStatus: 'Married',  occupation: 'Nurse',             status: 'Verified',    remarks: 'Government ID verified.' },
      { fullName: 'Pedro Villanueva', purok: 'P-11 Dologon', email: 'pedro@email.com',    contactNumber: '09171234512', gender: 'Male',   dateOfBirth: new Date('1961-10-03'), civilStatus: 'Married',  occupation: 'Retired',           status: 'Pending' },
      { fullName: 'Rosa Mendoza',     purok: 'P-8 Dologon',  email: 'rosa@email.com',     contactNumber: '09171234513', gender: 'Female', dateOfBirth: new Date('2000-07-15'), civilStatus: 'Single',   occupation: 'Cashier',           status: 'Rejected',    remarks: 'Selfie with ID does not match.' },
      { fullName: 'Arturo Enriquez',  purok: 'P-10 Dologon', email: 'arturo@email.com',   contactNumber: '09171234514', gender: 'Male',   dateOfBirth: new Date('1977-03-08'), civilStatus: 'Married',  occupation: 'Security Guard',    status: 'Pending' },
      { fullName: 'Carla Morales',    purok: 'P-14 Dologon', email: 'carla@email.com',    contactNumber: '09171234515', gender: 'Female', dateOfBirth: new Date('1991-11-21'), civilStatus: 'Single',   occupation: 'Call Center Agent', status: 'Under Review' },
    ];
    for (const p of profiles) {
      await VerificationProfile.create(p);
      console.log(`Created verification profile: ${p.fullName} [${p.status}]`);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => { console.error(err); process.exit(1); });
