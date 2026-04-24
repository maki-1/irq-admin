const VerificationProfile = require('../models/VerificationProfile');
const ResidentUser        = require('../models/ResidentUser');
const sendEmail           = require('../utils/sendEmail');
const sendSms             = require('../utils/sendSms');

const APPROVED_FILTER = {
  $or: [{ verified: true }, { status: { $in: ['approved', 'Approved'] } }],
};

// GET /api/verifications/stats
exports.getStats = async (req, res) => {
  try {
    const [total, pending] = await Promise.all([
      VerificationProfile.countDocuments(APPROVED_FILTER),
      VerificationProfile.countDocuments({ status: { $in: ['pending', 'Pending'] } }),
    ]);
    res.json({ total, pending });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/verifications/approved
exports.getLatestApproved = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const profiles = await VerificationProfile.find(APPROVED_FILTER)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit);
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/verifications
exports.getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status: { $regex: new RegExp(`^${status}$`, 'i') } } : {};
    const profiles = await VerificationProfile.find(filter).sort({ createdAt: -1 });
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/verifications/:id
exports.getOne = async (req, res) => {
  try {
    const profile = await VerificationProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/verifications
exports.create = async (req, res) => {
  try {
    const profile = await VerificationProfile.create(req.body);
    res.status(201).json(profile);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PATCH /api/verifications/:id/review
exports.review = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const allowed = ['under review', 'approved', 'rejected'];
    if (!allowed.includes(status?.toLowerCase())) {
      return res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}` });
    }

    const profile = await VerificationProfile.findByIdAndUpdate(
      req.params.id,
      { status, remarks: remarks || '', reviewedBy: req.user._id, reviewedAt: new Date() },
      { new: true }
    );
    if (!profile) return res.status(404).json({ message: 'Profile not found' });

    const s = status.toLowerCase();
    if (s === 'approved' || s === 'rejected') {
      // Get contact info — try verificationprofile first, fall back to linked user doc
      let email         = profile.email         || null;
      let contactNumber = profile.contactNumber || null;

      if ((!email || !contactNumber) && profile.user) {
        try {
          const residentUser = await ResidentUser.findById(profile.user);
          if (residentUser) {
            email         = email         || residentUser.email         || residentUser.gmail  || null;
            contactNumber = contactNumber || residentUser.contactNumber || residentUser.phone  ||
                            residentUser.mobileNumber || residentUser.contact || null;
          }
        } catch (e) {
          console.error('[review] Failed to fetch resident user for contact info:', e.message);
        }
      }

      console.log(`[review] Notifying — status: ${s}, email: ${email}, phone: ${contactNumber}`);

      const name    = profile.fullName || 'Resident';
      const subject = s === 'approved'
        ? 'Registration Approved – iRequestDologon'
        : 'Registration Update – iRequestDologon';

      const emailHtml = s === 'approved'
        ? `<p>Dear <strong>${name}</strong>,</p>
           <p>🎉 Your registration with <strong>Barangay Dologon</strong> has been
           <strong style="color:#156D07">approved</strong>. You are now a verified resident.</p>
           <p>You may now use the iRequestDologon app to request barangay documents.</p>
           <p style="color:#888;font-size:12px">Barangay Dologon – iRequestDologon</p>`
        : `<p>Dear <strong>${name}</strong>,</p>
           <p>We regret to inform you that your registration has been
           <strong style="color:#BE123C">rejected</strong>.</p>
           ${remarks ? `<p><strong>Reason:</strong> ${remarks}</p>` : ''}
           <p>Please visit the Barangay Office or resubmit with complete documents.</p>
           <p style="color:#888;font-size:12px">Barangay Dologon – iRequestDologon</p>`;

      const smsText = s === 'approved'
        ? `Hi ${name}, your Barangay Dologon registration has been APPROVED. You can now request documents via iRequestDologon. -Brgy. Dologon`
        : `Hi ${name}, your Barangay Dologon registration was REJECTED.${remarks ? ' Reason: ' + remarks : ''} Visit the Barangay Office. -Brgy. Dologon`;

      if (email) {
        sendEmail({ to: email, subject, html: emailHtml })
          .then(() => console.log(`[review] Email sent to ${email}`))
          .catch((e) => console.error(`[review] Email failed (${email}):`, e.message));
      } else {
        console.warn('[review] No email address found — skipping email notification');
      }

      if (contactNumber) {
        sendSms({ to: contactNumber, message: smsText })
          .then(() => console.log(`[review] SMS sent to ${contactNumber}`))
          .catch((e) => console.error(`[review] SMS failed (${contactNumber}):`, e.message));
      } else {
        console.warn('[review] No contact number found — skipping SMS notification');
      }
    }

    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
