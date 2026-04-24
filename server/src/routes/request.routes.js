const router = require('express').Router();
const ctrl = require('../controllers/request.controller');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect);

router.get('/',         requireRole('Secretary', 'Barangay Captain'), ctrl.getAll);
router.get('/:id',     requireRole('Secretary', 'Barangay Captain'), ctrl.getOne);
router.patch('/:id/status', requireRole('Secretary', 'Barangay Captain'), ctrl.updateStatus);

module.exports = router;
