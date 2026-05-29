const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const mongoose  = require('mongoose');
const cloudinary = require('../config/cloudinary');
const ResidentUser = require('../models/ResidentUser');
const sendSms   = require('../utils/sendSms');
const sendEmail = require('../utils/sendEmail');

const signToken = (id) =>
  jwt.sign({ id, role: 'resident' }, process.env.JWT_SECRET, { expiresIn: '7d' });

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function safeUser(u) {
  const { password, otp, otpExpires, resetToken, resetTokenExpires, ...rest } = u;
  return rest;
}

/* ── GET /api/auth/check-username ───────────────────────── */
exports.checkUsername = async (req, res) => {
  try {
    const exists = await ResidentUser.findOne({ username: req.query.username });
    res.json({ available: !exists });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/auth/check-contact ────────────────────────── */
exports.checkContact = async (req, res) => {
  try {
    const exists = await ResidentUser.findOne({ contactNumber: req.query.contact });
    res.json({ available: !exists });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/auth/check-email ──────────────────────────── */
exports.checkEmail = async (req, res) => {
  try {
    const exists = await ResidentUser.findOne({ email: req.query.email?.toLowerCase() });
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

    const existing = await ResidentUser.findOne({
      $or: [{ username }, { contactNumber }],
    });
    if (existing) {
      const field = existing.username === username ? 'Username' : 'Contact number';
      return res.status(400).json({ message: `${field} is already registered` });
    }

    const hashed = await bcrypt.hash(password, 12);
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const user = await ResidentUser.create({
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
    });

    // Send OTP via SMS
    const smsText = `Your iRequestD verification code is: ${otp}. Valid for 10 minutes. -Brgy. Dologon`;
    sendSms({ to: contactNumber, message: smsText }).catch((e) =>
      console.error('[register] SMS failed:', e.message)
    );

    res.status(201).json({
      message: 'Account created. Please verify your OTP.',
      userId: user._id,
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

    const user = await ResidentUser.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (type === 'reset') {
      const resetToken = crypto.randomBytes(32).toString('hex');
      await ResidentUser.findByIdAndUpdate(userId, {
        otp: null, otpExpires: null,
        resetToken,
        resetTokenExpires: new Date(Date.now() + 15 * 60 * 1000),
      });
      return res.json({ message: 'OTP verified', resetToken });
    }

    // Regular account verification — return token so client can proceed
    const updated = await ResidentUser.findByIdAndUpdate(
      userId,
      { otp: null, otpExpires: null, isVerified: false, verificationStep: 0 },
      { new: true }
    ).lean();
    const token = signToken(updated._id);
    res.json({ message: 'Account verified successfully', token, user: safeUser(updated) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/auth/resend-otp ──────────────────────────── */
exports.resendOtp = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await ResidentUser.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = generateOtp();
    await ResidentUser.findByIdAndUpdate(userId, {
      otp,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
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
    const user = await ResidentUser.findOne({ contactNumber });
    if (!user) return res.status(404).json({ message: 'No account with that contact number' });

    const otp = generateOtp();
    await ResidentUser.findByIdAndUpdate(user._id, {
      otp,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
      otpType: 'reset',
    });

    const smsText = `Your iRequestD password reset code is: ${otp}. Valid for 10 minutes. -Brgy. Dologon`;
    sendSms({ to: contactNumber, message: smsText }).catch((e) =>
      console.error('[forgotPassword] SMS failed:', e.message)
    );

    res.json({ message: 'OTP sent', userId: user._id });
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
    const user = await ResidentUser.findOne({
      resetToken: token,
      resetTokenExpires: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired reset token' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await ResidentUser.findByIdAndUpdate(user._id, {
      password: hashed,
      resetToken: null,
      resetTokenExpires: null,
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

    const user = await ResidentUser.findOne({ username });
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid username or password' });

    const token = signToken(user._id);
    const plain = user.toObject ? user.toObject() : { ...user };

    res.json({
      token,
      user: safeUser(plain),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/auth/me (resident) ────────────────────────── */
exports.getMe = async (req, res) => {
  try {
    const plain = req.resident;
    res.json(safeUser(plain));
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

    await ResidentUser.findByIdAndUpdate(req.resident._id, { avatar: result.secure_url });
    res.json({ avatarUrl: result.secure_url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/auth/change-password ─────────────────────── */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await ResidentUser.findById(req.resident._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await ResidentUser.findByIdAndUpdate(user._id, { password: hashed });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
