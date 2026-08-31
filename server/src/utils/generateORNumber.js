const prisma = require('../../lib/prisma');

/**
 * Generates a unique sequential OR number: OR-YYYY-NNNNN
 *
 * The previous implementation scanned requests for the highest existing
 * orNumber and added one. Despite its comment it was not atomic — two
 * concurrent calls read the same maximum and produced the same number, which
 * the unique index then rejected. Sorting was also lexicographic, so it would
 * have misbehaved past 99999.
 *
 * This draws from the same `counters` row the Flutter backend uses
 * (`orNumber-<year>`), so both services share one sequence and cannot collide.
 * The upsert is a single atomic statement.
 */
async function generateORNumber(client = prisma) {
  const year = new Date().getFullYear();

  const counter = await client.counter.upsert({
    where: { id: `orNumber-${year}` },
    create: { id: `orNumber-${year}`, seq: 1 },
    update: { seq: { increment: 1 } },
  });

  return `OR-${year}-${String(counter.seq).padStart(5, '0')}`;
}

module.exports = generateORNumber;
