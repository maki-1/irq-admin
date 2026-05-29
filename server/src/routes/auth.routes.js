const router  = require('express').Router();
const multer  = require('multer');
const { login, getMe }  = require('../controllers/auth.controller');
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
router.get('/me', (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'resident') return residentProtect(req, res, () => residentCtrl.getMe(req, res));
    return protect(req, res, () => getMe(req, res));
  } catch {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
});
router.put('/avatar',               residentProtect, upload.single('avatar'), residentCtrl.updateAvatar);
router.post('/change-password',     residentProtect, residentCtrl.changePassword);

module.exports = router;
