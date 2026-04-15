const AuditTrail = require('../models/AuditTrail');

// GET /api/audit
exports.getAuditTrail = async (req, res) => {
  try {
    const logs = await AuditTrail.find()
      .populate('user', 'fullName role')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
