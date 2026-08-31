const prisma   = require('../../lib/prisma');
const { toApi } = require('../../lib/serialize');
const auditLog = require('../utils/auditLog');

// GET /api/audit
exports.getAuditTrail = async (req, res) => {
  try {
    const logs = await prisma.auditTrail.findMany({
      include: { admin: { select: { id: true, fullName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json(toApi(logs));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/audit  – client-side actions (e.g. printing) that have no server round-trip
exports.createAuditLog = async (req, res) => {
  try {
    const { action, details } = req.body;
    if (!action) return res.status(400).json({ message: 'action is required' });
    await auditLog({ user: req.user, action, details });
    res.sendStatus(201);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
