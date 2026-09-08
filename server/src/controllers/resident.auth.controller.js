const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const cloudinary = require('../config/cloudinary');
const prisma     = require('../../lib/prisma');
const { toApi }  = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');
const sendSms    = require('../utils/sendSms');
const sendEmail  = require('../utils/sendEmail');
const withTimeout = require('../../lib/withTimeout');

// Kept at 12 rounds, as before — deliberately stronger than the shared
// lib/password helper (10) used elsewhere. bcrypt stores the cost in the hash,
// so both verify against each other.
const ROUNDS = 12;

const signToken = (id) => {
  if (!process.env.JWT_SECRET) return id.toString();
  return jwt.sign({ id, role: 'resident' }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function safeUser(u) {
  if (!u) return u;
  const { password, otp, otpExpires, resetToken, resetTokenExpires, ...rest } = toApi(u);
  return rest;
}

// The review decision lives on the VerificationProfile — that is what barangay
// staff actually set, and what the mobile app gates on (it reads the same value
// as `accountStatus`). `User.isVerified` is only a cached mirror of it and can
// go stale: a resident moved back to "under review" after being approved keeps
// the boolean set, which used to leave the web portal open while the mobile app
// correctly showed "under review". Derive both here so the two clients agree.
async function withAccountState(user) {
  const base = safeUser(user);
  if (!base) return base;
  const profile = await prisma.verificationProfile.findUnique({
    where: { userId: user.id },
    select: { status: true },
  });
  const status = (profile?.status || '').toLowerCase();
  return {
    ...base,
    accountStatus: profile?.status || null,
    isVerified: status === 'approved',
  };
}

/* ── GET /api/auth/check-username ───────────────────────── */
exports.checkUsername = async (req, res) => {
  try {
    if (!req.query.username) return res.json({ available: false });
    const exists = await prisma.user.findUnique({ where: { username: req.query.username } });
    res.json({ available: !exists });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/auth/check-contact ────────────────────────── */
exports.checkContact = async (req, res) => {
  try {
    if (!req.query.contact) return res.json({ available: false });
    const exists = await prisma.user.findUnique({ where: { contactNumber: req.query.contact } });
    res.json({ available: !exists });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/auth/check-email ──────────────────────────── */
exports.checkEmail = async (req, res) => {
  try {
    const email = req.query.email?.toLowerCase();
    if (!email) return res.json({ available: false });
    const exists = await prisma.user.findUnique({ where: { email } });
    res.json({ available: !exists });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/auth/register ────────────────────────────── */
exports.register = async (req, res) => {
  try {
    const { username, contactNumber, email, password } = req.body;

    if (!username || !contactNumber || !password) {
      return res.status(400).json({ message: 'Username, contact number, and password are required' });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { contactNumber }] },
    });
    if (existing) {
      const field = existing.username === username ? 'Username' : 'Contact number';
      return res.status(400).json({ message: `${field} is already registered` });
    }

    const hashed = await bcrypt.hash(password, ROUNDS);
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const user = await prisma.user.create({
      data: {
        username,
        contactNumber,
        email: email?.toLowerCase() || null,
        password: hashed,
        otp,
        otpExpires,
        otpType: 'verification',
        isVerified: false,
        verificationStep: 0,
        verificationStatus: null,
      },
    });

    // Send OTP via SMS
    const smsText = `Your iRequestD verification code is: ${otp}. Valid for 10 minutes. -Brgy. Dologon`;
    sendSms({ to: contactNumber, message: smsText }).catch((e) =>
      console.error('[register] SMS failed:', e.message)
    );

    res.status(201).json({
      message: 'Account created. Please verify your OTP.',
      userId: user.id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/auth/verify-otp ──────────────────────────── */
exports.verifyOtp = async (req, res) => {
  try {
    const { userId, otp, type } = req.body;
    if (!userId || !otp) return res.status(400).json({ message: 'userId and otp are required' });
    if (!isUuid(userId)) return res.status(404).json({ message: 'User not found' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (!user.otpExpires || new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (type === 'reset') {
      const resetToken = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: userId },
        data: {
          otp: null, otpExpires: null,
          resetToken,
          resetTokenExpires: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      return res.json({ message: 'OTP verified', resetToken });
    }

    // Regular account verification — return token so client can proceed
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { otp: null, otpExpires: null, isVerified: false, verificationStep: 0 },
    });
    const token = signToken(updated.id);
    res.json({ message: 'Account verified successfully', token, user: safeUser(updated) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/auth/resend-otp ──────────────────────────── */
exports.resendOtp = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!isUuid(userId)) return res.status(404).json({ message: 'User not found' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = generateOtp();
    await prisma.user.update({
      where: { id: userId },
      data: { otp, otpExpires: new Date(Date.now() + 10 * 60 * 1000) },
    });

    const smsText = `Your iRequestD OTP is: ${otp}. Valid for 10 minutes. -Brgy. Dologon`;
    sendSms({ to: user.contactNumber, message: smsText }).catch((e) =>
      console.error('[resendOtp] SMS failed:', e.message)
    );

    res.json({ message: 'OTP resent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/auth/forgot-password ─────────────────────── */
exports.forgotPassword = async (req, res) => {
  try {
    const { contactNumber } = req.body;
    if (!contactNumber) {
      return res.status(404).json({ message: 'No account with that contact number' });
    }
    const user = await prisma.user.findUnique({ where: { contactNumber } });
    if (!user) return res.status(404).json({ message: 'No account with that contact number' });

    const otp = generateOtp();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otp,
        otpExpires: new Date(Date.now() + 10 * 60 * 1000),
        otpType: 'reset',
      },
    });

    // Delivery is awaited and reported honestly. The previous version fired the
    // SMS fire-and-forget and always answered "OTP sent", so a resident whose
    // message failed (right now: every one, the UNISMS account has no sender_id)
    // waited forever for a code that never came. SMS is the primary channel;
    // email is a fallback for the residents who have one on file.
    const smsText = `Your iRequestD password reset code is: ${otp}. Valid for 10 minutes. -Brgy. Dologon`;

    let channel = null;
    let smsError = null;
    try {
      // Hard deadline on top of sendSms's own axios timeout — belt and
      // suspenders, so this can never be the reason the request hangs.
      await withTimeout(sendSms({ to: contactNumber, message: smsText }), 12000, 'SMS send');
      channel = 'sms';
    } catch (e) {
      smsError = e.message;
      console.error('[forgotPassword] SMS failed:', e.message);
    }

    if (!channel && user.email) {
      try {
        await withTimeout(sendEmail({
          to: user.email,
          subject: 'iRequestDologon password reset code',
          html: `<p>Your password reset code is <strong style="font-size:20px;letter-spacing:2px">${otp}</strong>.</p>
                 <p>It is valid for 10 minutes. If you did not request this, you can ignore this email.</p>
                 <p style="color:#888;font-size:12px">Barangay Dologon &ndash; iRequestDologon</p>`,
        }), 12000, 'Email send');
        channel = 'email';
      } catch (e) {
        console.error('[forgotPassword] email fallback failed:', e.message);
      }
    }

    if (!channel) {
      // Nothing reached the resident. Tell them, instead of pretending it sent.
      return res.status(502).json({
        message:
          'We could not send your reset code right now. Please try again later or visit the barangay office.',
      });
    }

    const sentTo =
      channel === 'sms'
        ? 'your registered mobile number'
        : `your email (${user.email.replace(/(.{2}).*(@.*)/, '$1***$2')})`;
    res.json({ message: `Reset code sent to ${sentTo}`, userId: user.id, channel });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/auth/reset-password ──────────────────────── */
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() },
      },
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired reset token' });

    const hashed = await bcrypt.hash(newPassword, ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpires: null },
    });
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/auth/login (resident branch) ─────────────── */
exports.residentLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid username or password' });

    const token = signToken(user.id);

    res.json({
      token,
      user: await withAccountState(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/auth/me (resident) ────────────────────────── */
exports.getMe = async (req, res) => {
  try {
    res.json(await withAccountState(req.resident));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── PUT /api/auth/avatar ───────────────────────────────── */
exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'irequestd/avatars', resource_type: 'image' },
        (err, r) => (err ? reject(err) : resolve(r))
      );
      stream.end(req.file.buffer);
    });

    await prisma.user.update({
      where: { id: req.resident.id },
      data: { avatar: result.secure_url },
    });
    res.json({ avatarUrl: result.secure_url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/auth/change-password ─────────────────────── */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.resident.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, ROUNDS);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
