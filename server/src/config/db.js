const prisma = require('../../lib/prisma');

// Prisma connects lazily on the first query; this fails fast at boot the way
// mongoose.connect() did, rather than surfacing the error on a user request.
const connectDB = async () => {
  try {
    const [row] = await prisma.$queryRaw`SELECT current_database() AS db`;
    console.log(`Postgres connected (db: ${row.db})`);
  } catch (error) {
    console.error(`Postgres connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
