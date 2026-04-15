const router = require('express').Router();
const { getAllUsers, getUser, updateRole } = require('../controllers/user.controller');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect);

router.get('/', requireRole('Secretary', 'Barangay Captain'), getAllUsers);
router.get('/:id', getUser);
router.patch('/:id/role', requireRole('Barangay Captain'), updateRole);

module.exports = router;
