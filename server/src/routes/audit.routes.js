const router = require('express').Router();
const { getAuditTrail, createAuditLog } = require('../controllers/audit.controller');
const { protect, requireRole } = require('../middleware/auth');

router.get('/',  protect, requireRole('Secretary', 'Collector', 'Barangay Captain'), getAuditTrail);
router.post('/', protect, requireRole('Secretary', 'Collector', 'Barangay Captain'), createAuditLog);

module.exports = router;
