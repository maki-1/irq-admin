require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  const db = mongoose.connection.db;

  const requests = await db.collection('requests').updateMany(
    { amountPaid: { $gt: 999 } },
    [{ $set: { amountPaid: { $divide: ['$amountPaid', 100] } } }]
  );
  console.log(`requests updated: ${requests.modifiedCount}`);

  const payments = await db.collection('payments').updateMany(
    { amount: { $gt: 999 } },
    [{ $set: { amount: { $divide: ['$amount', 100] } } }]
  );
  console.log(`payments updated: ${payments.modifiedCount}`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(console.error);
