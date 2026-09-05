const router = require('express').Router();
const {
  getAllUsers, getUser, updateRole, getMe, updateMe,
  createUser, resetPassword, setActive, updateUser,
} = require('../controllers/user.controller');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect);

router.get('/me',   getMe);
router.patch('/me', updateMe);

router.get('/',    requireRole('Secretary', 'Barangay Captain'), getAllUsers);
router.post('/',   requireRole('Barangay Captain'), createUser);
router.get('/:id', getUser);

router.patch('/:id',                requireRole('Barangay Captain'), updateUser);
router.patch('/:id/role',           requireRole('Barangay Captain'), updateRole);
router.patch('/:id/reset-password', requireRole('Barangay Captain'), resetPassword);
router.patch('/:id/active',         requireRole('Barangay Captain'), setActive);

module.exports = router;
