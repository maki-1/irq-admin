const router = require('express').Router();
const ctrl   = require('../controllers/release.controller');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect);

router.get('/',                    requireRole('Secretary', 'Barangay Captain'), ctrl.getAll);
router.patch('/:id/claim-status',  requireRole('Secretary', 'Barangay Captain'), ctrl.updateClaimStatus);

module.exports = router;
