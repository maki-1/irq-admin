const router = require('express').Router();
const ctrl   = require('../controllers/purokClearanceFee.controller');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect);

router.get('/all-fees', requireRole('Barangay Captain', 'Secretary', 'Collector', 'Purok Leader'), ctrl.getAll);
router.put('/:purokName', requireRole('Barangay Captain'), ctrl.upsert);

module.exports = router;
