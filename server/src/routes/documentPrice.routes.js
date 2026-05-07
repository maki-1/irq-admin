const router  = require('express').Router();
const ctrl    = require('../controllers/documentPrice.controller');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect);
router.get('/',     requireRole('Barangay Captain', 'Secretary', 'Collector'), ctrl.getAll);
router.patch('/:id', requireRole('Barangay Captain'), ctrl.update);

module.exports = router;
