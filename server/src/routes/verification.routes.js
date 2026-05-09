const router = require('express').Router();
const ctrl = require('../controllers/verification.controller');
const { protect, requireRole } = require('../middleware/auth');

// Public — clients submit their own profile
router.post('/', ctrl.create);

// Protected
router.use(protect);
router.get('/purok-stats',    requireRole('Barangay Captain'), ctrl.getPurokStats);
router.get('/resident-count', requireRole('Secretary', 'Barangay Captain', 'Collector'), ctrl.getResidentCount);
router.get('/stats',    requireRole('Secretary', 'Barangay Captain'), ctrl.getStats);
router.get('/approved', requireRole('Secretary', 'Barangay Captain'), ctrl.getLatestApproved);
router.get('/',         requireRole('Secretary', 'Barangay Captain', 'Purok Leader'), ctrl.getAll);
router.get('/:id',  requireRole('Secretary', 'Barangay Captain'), ctrl.getOne);
router.patch('/:id/review',  requireRole('Secretary', 'Barangay Captain'), ctrl.review);
router.delete('/:id/reset',  requireRole('Secretary', 'Barangay Captain'), ctrl.reset);

module.exports = router;
