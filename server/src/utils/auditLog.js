const prisma = require('../../lib/prisma');

// `username` and `role` stay denormalised so an entry still reads correctly
// after the admin it refers to is removed (adminId is nullable, ON DELETE SET NULL).
const auditLog = async ({ user, action, details }) => {
  await prisma.auditTrail.create({
    data: {
      adminId: user?.id ?? null,
      username: user?.fullName ?? null,
      role: user?.role ?? null,
      action,
      details: details ?? null,
    },
  });
};

module.exports = auditLog;
