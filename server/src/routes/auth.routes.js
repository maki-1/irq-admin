const router  = require('express').Router();
const multer  = require('multer');
const jwt     = require('jsonwebtoken');
const prisma  = require('../../lib/prisma');
const { toApi }  = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');
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
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });

  if (process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'resident') return residentProtect(req, res, () => residentCtrl.getMe(req, res));
      return protect(req, res, () => getMe(req, res));
    } catch {
      return res.status(401).json({ message: 'Token invalid or expired' });
    }
  }

  // Development-only path: with no JWT_SECRET the token is treated as a raw id
  // and not verified. Refused in production — see middleware/auth.js.
  if (process.env.NODE_ENV === 'production') {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }

  try {
    if (!isUuid(token)) return res.status(401).json({ message: 'Token invalid or expired' });

    const admin = await prisma.admin.findUnique({
      where: { id: token },
      select: {
        id: true, legacyId: true, fullName: true, purok: true, email: true,
        role: true, oauthProvider: true, oauthId: true, createdAt: true, updatedAt: true,
      },
    });
    if (admin) return res.json(toApi(admin));

    // Route residents through the same controller as the JWT path, so the
    // derived isVerified/accountStatus match production instead of returning
    // the raw (possibly stale) User row.
    const resident = await prisma.user.findUnique({ where: { id: token } });
    if (resident) {
      req.resident = resident;
      return residentCtrl.getMe(req, res);
    }

    res.status(401).json({ message: 'Token invalid or expired' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.put('/avatar',               residentProtect, upload.single('avatar'), residentCtrl.updateAvatar);
router.post('/change-password',     residentProtect, residentCtrl.changePassword);

// Staff sign-out — records the logout on the audit trail (any staff role).
router.post('/logout', protect, logout);

module.exports = router;
