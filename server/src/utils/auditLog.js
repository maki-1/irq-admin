const AuditTrail = require('../models/AuditTrail');

const auditLog = async ({ user, action, details }) => {
  await AuditTrail.create({
    user: user?._id,
    username: user?.fullName,
    role: user?.role,
    action,
    details,
  });
};

module.exports = auditLog;
