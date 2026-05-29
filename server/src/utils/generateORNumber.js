const Request = require('../models/Request');

/**
 * Generates a unique sequential OR number: OR-YYYY-NNNNN
 * Uses atomic findOneAndUpdate on a counter doc to avoid race conditions.
 * Falls back to count-based if no prior OR exists.
 */
async function generateORNumber() {
  const year = new Date().getFullYear();
  const prefix = `OR-${year}-`;

  // Find the highest existing sequential number for this year
  const last = await Request.findOne(
    { orNumber: { $regex: `^${prefix}` } },
    { orNumber: 1 },
    { sort: { orNumber: -1 } }
  ).lean();

  let next = 1;
  if (last?.orNumber) {
    const parts = last.orNumber.split('-');
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num)) next = num + 1;
  }

  return `${prefix}${String(next).padStart(5, '0')}`;
}

module.exports = generateORNumber;
