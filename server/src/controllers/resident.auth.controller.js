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

const OTP_TTL_MS = 10 * 60 * 1000;
// Six digits with unlimited guesses falls to a script in minutes, so a code is
// burned after this many wrong tries and the resident has to request a new one.
const OTP_MAX_ATTEMPTS = 5;

function generateOtp() {
  // crypto.randomInt is uniform and unpredictable; Math.random is neither, and
  // a guessable verification code defeats the point of having one.
  return crypto.randomInt(100000, 1000000).toString();
}

function safeUser(u) {
  if (!u) return u;
  const {
    password, otp, otpExpires, otpAttempts, resetToken, resetTokenExpires, ...rest
  } = toApi(u);
  return rest;
}

const maskContact = (n) => (n ? `${n.slice(0, 4)}***${n.slice(-3)}` : '');
const maskEmail   = (e) => (e ? e.replace(/(.{2}).*(@.*)/, '$1***$2') : '');

/**
 * Send a one-time code to the resident. SMS is the primary channel; email is a
 * fallback for the residents who have one on file.
 *
 * Delivery is awaited and the outcome reported honestly. The fire-and-forget
 * version this replaces always answered "OTP sent", so a resident whose message
 * failed (which right now is every one — the UNISMS account has no sender_id)
 * waited forever for a code that never came. Now that login is gated on the
 * code, silently failing to deliver it locks the account instead of merely
 * annoying them.
 *
 * @returns {Promise<'sms'|'email'|null>} the channel that accepted it, or null.
 */
async function deliverOtp({ contactNumber, email, otp, purpose }) {
  const copy = purpose === 'reset'
    ? { sms: `Your iRequestD password reset code is: ${otp}. Valid for 10 minutes. -Brgy. Dologon`,
        subject: 'iRequestDologon password reset code',
        lead: 'Your password reset code is' }
    : { sms: `Your iRequestD verification code is: ${otp}. Valid for 10 minutes. -Brgy. Dologon`,
        subject: 'iRequestDologon verification code',
        lead: 'Your account verification code is' };

  try {
    // Hard deadline on top of sendSms's own axios timeout — belt and
    // suspenders, so this can never be the reason the request hangs.
    await withTimeout(sendSms({ to: contactNumber, message: copy.sms }), 12000, 'SMS send');
    return 'sms';
  } catch (e) {
    console.error(`[otp:${purpose}] SMS failed:`, e.message);
  }

  if (!email) return null;
  try {
    await withTimeout(sendEmail({
      to: email,
      subject: copy.subject,
      html: `<p>${copy.lead} <strong style="font-size:20px;letter-spacing:2px">${otp}</strong>.</p>
             <p>It is valid for 10 minutes. If you did not request this, you can ignore this email.</p>
             <p style="color:#888;font-size:12px">Barangay Dologon &ndash; iRequestDologon</p>`,
    }), 12000, 'Email send');
    return 'email';
  } catch (e) {
    console.error(`[otp:${purpose}] email fallback failed:`, e.message);
    return null;
  }
}

const sentToLabel = (channel, user) =>
  channel === 'sms'
    ? `your registered mobile number (${maskContact(user.contactNumber)})`
    : `your email (${maskEmail(user.email)})`;

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

// Only an account that actually passed its OTP owns an identifier. A row left
// behind by an abandoned registration still holds the unique index, but
// register() reclaims it — so reporting it as taken here would stop the signup
// form before it ever got the chance, and strand the resident for good.
async function claimsIdentifierAsync(row) {
  if (!row) return false;
  if (row.contactVerified) return true;
  return hasHistory(row);
}

// An unverified row is only safe to hand to a new signup if nothing is hanging
// off it. Rows created while login was ungated could have reached the
// verification wizard and submitted documents, and those must never be passed
// on to whoever types the username next.
async function hasHistory(user) {
  const [profile, requests] = await Promise.all([
    prisma.verificationProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    prisma.request.count({ where: { userId: user.id } }),
  ]);
  return Boolean(profile) || requests > 0;
}

/* ── GET /api/auth/check-username ───────────────────────── */
exports.checkUsername = async (req, res) => {
  try {
    if (!req.query.username) return res.json({ available: false });
    const exists = await prisma.user.findUnique({ where: { username: req.query.username } });
    res.json({ available: !(await claimsIdentifierAsync(exists)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/auth/check-contact ────────────────────────── */
exports.checkContact = async (req, res) => {
  try {
    if (!req.query.contact) return res.json({ available: false });
    const exists = await prisma.user.findUnique({ where: { contactNumber: req.query.contact } });
    res.json({ available: !(await claimsIdentifierAsync(exists)) });
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
    res.json({ available: !(await claimsIdentifierAsync(exists)) });
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

    const normalisedEmail = email?.toLowerCase() || null;

    const clashes = await prisma.user.findMany({
      where: {
        OR: [
          { username },
          { contactNumber },
          ...(normalisedEmail ? [{ email: normalisedEmail }] : []),
        ],
      },
    });

    // A verified account — or an unverified one that nevertheless accumulated a
    // profile or requests back when login was ungated — owns the identifier.
    const owners = [];
    for (const u of clashes) {
      if (await claimsIdentifierAsync(u)) owners.push(u);
    }
    const taken = owners[0];
    if (taken) {
      const field =
        taken.username === username ? 'Username'
        : taken.contactNumber === contactNumber ? 'Contact number'
        : 'Email';
      return res.status(400).json({ message: `${field} is already registered` });
    }

    // Otherwise every clashing row is an empty, abandoned registration that
    // never passed OTP. Before login was gated these were harmless; now they
    // would burn the username and phone number forever, so a single one is
    // simply reclaimed — the details are re-entered here and the code re-sent.
    // Two different abandoned rows is the one case we cannot reclaim silently,
    // so it is sent back through login, which routes to the OTP screen.
    if (clashes.length > 1) {
      return res.status(409).json({
        message:
          'These details were already registered but never verified. Sign in to continue verification.',
      });
    }

    const hashed = await bcrypt.hash(password, ROUNDS);
    const otp = generateOtp();
    const otpData = {
      otp,
      otpExpires: new Date(Date.now() + OTP_TTL_MS),
      otpType: 'verification',
      otpAttempts: 0,
      contactVerified: false,
      contactVerifiedAt: null,
      isVerified: false,
      verificationStep: 0,
      verificationStatus: null,
    };

    const stale = clashes[0];
    const user = stale
      ? await prisma.user.update({
          where: { id: stale.id },
          data: { username, contactNumber, email: normalisedEmail, password: hashed, ...otpData },
        })
      : await prisma.user.create({
          data: { username, contactNumber, email: normalisedEmail, password: hashed, ...otpData },
        });

    const channel = await deliverOtp({
      contactNumber,
      email: normalisedEmail,
      otp,
      purpose: 'verification',
    });

    if (!channel) {
      // The account cannot be used until the code is entered, so an undelivered
      // code is a failed registration — say so rather than parking the resident
      // on an OTP screen waiting for a message that is not coming. The row is
      // left behind deliberately: it is unverified, so the retry above reclaims
      // it instead of reporting the username as taken.
      return res.status(502).json({
        message:
          'We could not send your verification code right now. Please try again later or visit the barangay office.',
        userId: user.id,
      });
    }

    res.status(201).json({
      message: `Account created. Verification code sent to ${sentToLabel(channel, user)}.`,
      userId: user.id,
      channel,
      sentTo: channel === 'sms' ? maskContact(user.contactNumber) : maskEmail(user.email),
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

    if (!user.otp || !user.otpExpires) {
      return res.status(400).json({ message: 'No verification code is pending. Request a new one.' });
    }

    // The code a resident holds was issued for one purpose, and each purpose
    // hands back a different capability — an account session, or a password
    // reset token. Without this check a reset code sent to a phone could be
    // replayed as account verification, and vice versa.
    const wantReset = type === 'reset';
    if (wantReset !== (user.otpType === 'reset')) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if ((user.otpAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({
        message: 'Too many incorrect attempts. Request a new code.',
        attemptsRemaining: 0,
      });
    }

    // Constant-time compare so the code cannot be recovered a digit at a time.
    const supplied = String(otp);
    const correct =
      supplied.length === user.otp.length &&
      crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(user.otp));

    if (!correct) {
      const { otpAttempts } = await prisma.user.update({
        where: { id: userId },
        data: { otpAttempts: { increment: 1 } },
        select: { otpAttempts: true },
      });
      const attemptsRemaining = Math.max(0, OTP_MAX_ATTEMPTS - otpAttempts);
      if (attemptsRemaining === 0) {
        // Burn the code outright rather than leaving a guessed-at value live.
        await prisma.user.update({
          where: { id: userId },
          data: { otp: null, otpExpires: null },
        });
        return res.status(429).json({
          message: 'Too many incorrect attempts. Request a new code.',
          attemptsRemaining: 0,
        });
      }
      return res.status(400).json({ message: 'Invalid OTP', attemptsRemaining });
    }

    if (wantReset) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: userId },
        data: {
          otp: null, otpExpires: null, otpType: null, otpAttempts: 0,
          resetToken,
          resetTokenExpires: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      return res.json({ message: 'OTP verified', resetToken });
    }

    // Account verification. `contactVerified` is what login is gated on;
    // `isVerified` stays false because that one tracks the barangay's review of
    // the documents, which has not even been submitted yet.
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        otp: null, otpExpires: null, otpType: null, otpAttempts: 0,
        contactVerified: true,
        contactVerifiedAt: new Date(),
        isVerified: false,
        verificationStep: 0,
      },
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

    // Keep the purpose of the in-flight code: resending mid password-reset must
    // not quietly turn it into a code that verifies the account.
    const purpose = user.otpType === 'reset' ? 'reset' : 'verification';
    if (purpose === 'verification' && user.contactVerified) {
      return res.status(400).json({ message: 'This account is already verified. Please sign in.' });
    }

    const otp = generateOtp();
    await prisma.user.update({
      where: { id: userId },
      data: {
        otp,
        otpExpires: new Date(Date.now() + OTP_TTL_MS),
        otpType: purpose === 'reset' ? 'reset' : 'verification',
        // A fresh code gets a fresh budget; otherwise a locked-out resident
        // would still be locked out after asking for a new one.
        otpAttempts: 0,
      },
    });

    const channel = await deliverOtp({
      contactNumber: user.contactNumber,
      email: user.email,
      otp,
      purpose,
    });
    if (!channel) {
      return res.status(502).json({
        message:
          'We could not send your code right now. Please try again later or visit the barangay office.',
      });
    }

    res.json({ message: `Code resent to ${sentToLabel(channel, user)}`, channel });
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
        otpExpires: new Date(Date.now() + OTP_TTL_MS),
        otpType: 'reset',
        otpAttempts: 0,
      },
    });

    const channel = await deliverOtp({
      contactNumber,
      email: user.email,
      otp,
      purpose: 'reset',
    });

    if (!channel) {
      // Nothing reached the resident. Tell them, instead of pretending it sent.
      return res.status(502).json({
        message:
          'We could not send your reset code right now. Please try again later or visit the barangay office.',
      });
    }

    res.json({ message: `Reset code sent to ${sentToLabel(channel, user)}`, userId: user.id, channel });
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

    // The password alone is not enough: an account whose registration OTP was
    // never entered has not proved it owns the contact it was opened with, so
    // it gets no token. This is the gate that was missing — previously the
    // resident could cancel out of the OTP screen and sign straight in.
    if (!user.contactVerified) {
      // Give them a live code to finish with, but only if one is not already in
      // flight. Minting on every attempt would turn the login button into a way
      // to fire off unlimited SMS, and would invalidate the code the resident is
      // already holding each time they retry.
      const pending = user.otp && user.otpType !== 'reset' &&
        user.otpExpires && new Date(user.otpExpires) > new Date();

      let channel = 'existing';
      if (!pending) {
        const otp = generateOtp();
        await prisma.user.update({
          where: { id: user.id },
          data: {
            otp,
            otpExpires: new Date(Date.now() + OTP_TTL_MS),
            otpType: 'verification',
            otpAttempts: 0,
          },
        });
        channel = await deliverOtp({
          contactNumber: user.contactNumber,
          email: user.email,
          otp,
          purpose: 'verification',
        });
      }

      return res.status(403).json({
        message:
          channel === null
            ? 'Your account is not verified yet, and we could not send a new code. Please try again later or visit the barangay office.'
            : 'Your account is not verified yet. Enter the code we sent you to finish signing up.',
        // The client uses these to route straight to the OTP screen rather than
        // showing a dead end. No token is issued.
        requiresOtpVerification: true,
        userId: user.id,
        maskedContact: user.email && channel === 'email'
          ? maskEmail(user.email)
          : maskContact(user.contactNumber),
        otpSent: channel !== null,
      });
    }

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
