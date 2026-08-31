const router = require('express').Router();
const ctrl = require('../controllers/verification.controller');
const { protect, requireRole } = require('../middleware/auth');

// Protected
router.use(protect);

// Was mounted above `protect` and commented "Public — clients submit their own
// profile". It is not how residents submit: they use /api/verification/step1-3,
// which is behind residentProtect. Left public it accepted an arbitrary userId
// AND a `status`, so anyone could create an already-approved profile for any
// account and skip secretary review entirely. No front-end calls it.
router.post('/', requireRole('Secretary', 'Barangay Captain'), ctrl.create);
router.get('/purok-stats',    requireRole('Barangay Captain'), ctrl.getPurokStats);
router.get('/resident-count', requireRole('Secretary', 'Barangay Captain', 'Collector'), ctrl.getResidentCount);
router.get('/stats',    requireRole('Secretary', 'Barangay Captain'), ctrl.getStats);
router.get('/approved', requireRole('Secretary', 'Barangay Captain'), ctrl.getLatestApproved);
router.get('/',         requireRole('Secretary', 'Barangay Captain'), ctrl.getAll);
router.get('/:id',  requireRole('Secretary', 'Barangay Captain'), ctrl.getOne);
router.patch('/:id/review',  requireRole('Secretary', 'Barangay Captain'), ctrl.review);
router.delete('/:id/reset',  requireRole('Secretary', 'Barangay Captain'), ctrl.reset);

module.exports = router;
