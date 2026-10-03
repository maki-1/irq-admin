const router  = require('express').Router();
const multer  = require('multer');
const { verifyToken } = require('../../lib/accountLifecycle');
const { login, getMe, logout }  = require('../controllers/auth.controller');
const residentCtrl      = require('../controllers/resident.auth.controller');
const { protect }       = require('../middleware/auth');
const { residentProtect } = require('../middleware/residentAuth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── Resident availability checks (public) ──
router.get('/check-username', residentCtrl.checkUsername);
router.get('/check-contact',  residentCtrl.checkContact);
router.get('/check-email',    residentCtrl.checkEmail);

// ── Resident registration & OTP ──
router.post('/register',        residentCtrl.register);
router.post('/verify-otp',      residentCtrl.verifyOtp);
router.post('/resend-otp',      residentCtrl.resendOtp);
router.post('/forgot-password', residentCtrl.forgotPassword);
router.post('/reset-password',  residentCtrl.resetPassword);

// ── Shared login (admin=email, resident=username) ──
router.post('/login', login);

// ── /me — works for both admin and resident based on token ──
router.get('/me', (req, res) => {
  if (!req.headers.authorization?.startsWith('Bearer ')) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = verifyToken(req.headers.authorization.split(' ')[1]);
    if (decoded.accountType === 'resident') return residentProtect(req, res, () => residentCtrl.getMe(req, res));
    return protect(req, res, () => getMe(req, res));
  } catch {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
});
router.put('/avatar',               residentProtect, upload.single('avatar'), residentCtrl.updateAvatar);
router.post('/change-password',     residentProtect, residentCtrl.changePassword);

// Staff sign-out — records the logout on the audit trail (any staff role).
router.post('/logout', protect, logout);

module.exports = router;
