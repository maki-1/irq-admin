const router = require('express').Router();
const ctrl = require('../controllers/verification.controller');
const { protect, requireRole } = require('../middleware/auth');

// Public — clients submit their own profile
router.post('/', ctrl.create);

// Protected — Secretary / Barangay Captain only
router.use(protect);
router.get('/stats', requireRole('Secretary', 'Barangay Captain'), ctrl.getStats);
router.get('/',     requireRole('Secretary', 'Barangay Captain'), ctrl.getAll);
router.get('/:id',  requireRole('Secretary', 'Barangay Captain'), ctrl.getOne);
router.patch('/:id/review', requireRole('Secretary', 'Barangay Captain'), ctrl.review);

module.exports = router;
