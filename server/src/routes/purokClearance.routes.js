const router = require('express').Router();
const {
  getPuroks, getMyFee, updateMyFee,
} = require('../controllers/purokClearance.controller');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect);

// Captain needs this to populate the purok dropdown when creating a Purok Leader account
router.get('/puroks', requireRole('Barangay Captain', 'Purok Leader'), getPuroks);

// Everything below is Purok Leader only
router.use(requireRole('Purok Leader'));

router.get('/my-fee',   getMyFee);
router.patch('/my-fee', updateMyFee);

module.exports = router;
