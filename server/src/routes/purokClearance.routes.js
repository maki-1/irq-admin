const router = require('express').Router();
const ctrl   = require('../controllers/purokClearance.controller');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect);

// Issuing a clearance IS the attestation, so only the Purok Leader of that
// purok may do it. The Barangay Captain can read the register for oversight but
// deliberately cannot issue — that would put a signature on someone else's
// attestation, which is the thing this design exists to avoid.
router.get('/residents', requireRole('Purok Leader'), ctrl.searchResidents);
router.get('/issued',    requireRole('Purok Leader'), ctrl.listIssued);
router.post('/issue',    requireRole('Purok Leader'), ctrl.issue);
router.patch('/:id/void', requireRole('Purok Leader'), ctrl.voidClearance);

module.exports = router;
