require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected:', mongoose.connection.name);

  const col = mongoose.connection.collection('verificationprofiles');

  const result = await col.updateMany(
    {},
    {
      $unset: {
        // renamed → new name already saved correctly going forward
        dateOfBirth:    '',
        schoolName:     '',
        graduationYear: '',
        // removed → combined into address
        purok:          '',
        houseNo:        '',
        city:           '',
        barangay:       '',
        // removed → combined into fullName
        firstName:      '',
        middleName:     '',
        lastName:       '',
      },
    }
  );

  console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
