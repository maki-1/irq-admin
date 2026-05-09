const router = require('express').Router();
const ctrl = require('../controllers/crop.controller');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect);
router.post('/detect-id', requireRole('Secretary', 'Barangay Captain'), ctrl.detectId);

module.exports = router;
