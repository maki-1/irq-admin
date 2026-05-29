const router = require('express').Router();
const ctrl   = require('../controllers/purokLeader.controller');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, requireRole('Purok Leader'));

router.get('/dashboard',              ctrl.getDashboard);
router.get('/requests',               ctrl.getRequests);
router.patch('/requests/:id/approve', ctrl.approveRequest);
router.patch('/requests/:id/reject',  ctrl.rejectRequest);

module.exports = router;
