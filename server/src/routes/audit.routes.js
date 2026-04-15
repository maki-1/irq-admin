const router = require('express').Router();
const { getAuditTrail } = require('../controllers/audit.controller');
const { protect, requireRole } = require('../middleware/auth');

router.get('/', protect, requireRole('Secretary', 'Barangay Captain'), getAuditTrail);

module.exports = router;
