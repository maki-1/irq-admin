const prisma     = require('../../lib/prisma');
const { toApi }  = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');
const sendEmail  = require('../utils/sendEmail');
const sendSms    = require('../utils/sendSms');
const auditLog   = require('../utils/auditLog');

// The Mongo filter was `{ $or: [{ verified: true }, { status: in [approved, Approved] }] }`.
// No document has ever carried a `verified` field, so the first clause never
// matched and the filter reduces to the status check.
const APPROVED_WHERE = {
  OR: [
    { status: { equals: 'approved', mode: 'insensitive' } },
  ],
};

// `create` previously accepted req.body wholesale; Prisma rejects unknown keys.
const WRITABLE = [
  'fullName', 'email', 'contactNumber', 'birthday', 'gender', 'civilStatus',
  'nationality', 'occupation', 'governmentId', 'selfieWithId', 'proofOfResidency',
  'idType', 'idName', 'idFront', 'idBack', 'facePhoto', 'educationCertificate',
  'age', 'yearsAtAddress', 'address', 'motherName', 'fatherName', 'isPwd',
  'isSenior', 'isIndigent', 'pwdProof', 'indigentProof', 'educationLevel',
  'isSoloParent', 'isIndigenousPeople', 'isPregnant', 'isNonResident', 'ethnicGroup',
  'school', 'yearGraduated', 'course', 'secondaryIdType', 'secondaryIdName',
  'secondaryIdFront', 'secondaryId2Type', 'secondaryId2Name', 'secondaryId2Front',
  'status', 'remarks', 'currentStep',
];
const INT_FIELDS = new Set(['age', 'yearsAtAddress', 'currentStep']);
const DATE_FIELDS = new Set(['birthday']);
const BOOL_FIELDS = new Set([
  'isPwd', 'isSenior', 'isIndigent',
  'isSoloParent', 'isIndigenousPeople', 'isPregnant', 'isNonResident',
]);

function pickWritable(body) {
  const out = {};
  for (const k of WRITABLE) {
    if (body[k] === undefined) continue;
    if (INT_FIELDS.has(k)) out[k] = body[k] === null ? null : parseInt(body[k], 10);
    else if (DATE_FIELDS.has(k)) out[k] = body[k] ? new Date(body[k]) : null;
    else if (BOOL_FIELDS.has(k)) out[k] = Boolean(body[k]);
    // yearGraduated is a string column here; the portal's model treated it as a number
    else if (k === 'yearGraduated') out[k] = body[k] === null ? '' : String(body[k]);
    else out[k] = body[k];
  }
  return out;
}

// Falls back to the resident record when the profile has no contact details.
async function contactFor(profile) {
  let email         = profile.email         || null;
  let contactNumber = profile.contactNumber || null;

  if ((!email || !contactNumber) && profile.userId) {
    try {
      const user = await prisma.user.findUnique({ where: { id: profile.userId } });
      if (user) {
        email         = email         || user.email         || null;
        contactNumber = contactNumber || user.contactNumber || null;
      }
    } catch (e) {
      console.error('Failed to fetch resident user for contact info:', e.message);
    }
  }
  return { email, contactNumber };
}

// GET /api/verifications/purok-stats
exports.getPurokStats = async (req, res) => {
  try {
    // The Mongo aggregation grouped by `purok` when present, else the first
    // comma-separated segment of the address. No profile carries a `purok`
    // field, so only the address branch is reachable. Grouped in JS — the
    // table is small and this keeps the derivation readable.
    const profiles = await prisma.verificationProfile.findMany({
      where: APPROVED_WHERE,
      select: { address: true },
    });

    const counts = new Map();
    for (const p of profiles) {
      const label = (p.address || 'Unknown').split(',')[0].trim() || 'Unknown';
      counts.set(label, (counts.get(label) || 0) + 1);
    }

    const stats = [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([purok, count]) => ({ purok, count }));

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/verifications/resident-count
exports.getResidentCount = async (req, res) => {
  try {
    const count = await prisma.user.count();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/verifications/stats
exports.getStats = async (req, res) => {
  try {
    const [total, pending] = await Promise.all([
      prisma.verificationProfile.count({ where: APPROVED_WHERE }),
      prisma.verificationProfile.count({
        where: { status: { equals: 'pending', mode: 'insensitive' } },
      }),
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
    const profiles = await prisma.verificationProfile.findMany({
      where: APPROVED_WHERE,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    res.json(toApi(profiles));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/verifications
exports.getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const where = status
      ? { status: { equals: status, mode: 'insensitive' } }
      : {};
    const profiles = await prisma.verificationProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(toApi(profiles));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/verifications/:id
exports.getOne = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Profile not found' });
    const profile = await prisma.verificationProfile.findUnique({ where: { id: req.params.id } });
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.json(toApi(profile));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/verifications
exports.create = async (req, res) => {
  try {
    // userId is required and has no default — it must come from the caller.
    const userId = req.body.userId || req.body.user;
    if (!isUuid(userId)) {
      return res.status(400).json({ message: 'A valid resident userId is required' });
    }
    const profile = await prisma.verificationProfile.create({
      data: { ...pickWritable(req.body), userId },
    });
    res.status(201).json(toApi(profile));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE /api/verifications/:id/reset
exports.reset = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Profile not found' });
    const profile = await prisma.verificationProfile.findUnique({ where: { id: req.params.id } });
    if (!profile) return res.status(404).json({ message: 'Profile not found' });

    const { remarks } = req.body || {};
    const { email, contactNumber } = await contactFor(profile);
    const name = profile.fullName || 'Resident';

    console.log(`[reset] Notifying — email: ${email}, phone: ${contactNumber}`);

    const reasonBlock = remarks
      ? `<p><strong>Reason:</strong> ${remarks}</p>`
      : '';

    const emailHtml = `
      <p>Dear <strong>${name}</strong>,</p>
      <p>Your verification profile with <strong>Barangay Dologon</strong> has been
      <strong style="color:#BE123C">rejected</strong> by the Barangay.</p>
      ${reasonBlock}
      <p>Your previously submitted information and documents have been cleared.
      Please open the <strong>iRequestDologon</strong> app and re-submit your
      verification form to continue.</p>
      <p>If you have questions, please visit the Barangay Office.</p>
      <p style="color:#888;font-size:12px">Barangay Dologon – iRequestDologon</p>`;

    const reasonSuffix = remarks ? ` Reason: ${remarks}.` : '';
    const smsText = `Hi ${name}, your Barangay Dologon verification was REJECTED.${reasonSuffix} Please open iRequestDologon and re-submit your verification form. -Brgy. Dologon`;

    if (email) {
      sendEmail({ to: email, subject: 'Verification Reset – Please Re-submit | iRequestDologon', html: emailHtml })
        .then(() => console.log(`[reset] Email sent to ${email}`))
        .catch((e) => console.error(`[reset] Email failed (${email}):`, e.message));
    } else {
      console.warn('[reset] No email address found — skipping email notification');
    }

    if (contactNumber) {
      sendSms({ to: contactNumber, message: smsText })
        .then(() => console.log(`[reset] SMS sent to ${contactNumber}`))
        .catch((e) => console.error(`[reset] SMS failed (${contactNumber}):`, e.message));
    } else {
      console.warn('[reset] No contact number found — skipping SMS notification');
    }

    await auditLog({
      user: req.user,
      action: 'Reset Residence Verification',
      details: `Resident: ${name} — rejected and notified to re-submit${remarks ? `. Reason: ${remarks}` : ''}`,
    });

    await prisma.verificationProfile.delete({ where: { id: req.params.id } });

    res.json({ message: 'Verification reset. Resident has been notified to fill up again.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/verifications/:id/review
exports.review = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const allowed = ['under review', 'approved'];
    if (!allowed.includes(status?.toLowerCase())) {
      return res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}` });
    }
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Profile not found' });

    const profile = await prisma.verificationProfile
      .update({
        where: { id: req.params.id },
        data: {
          status,
          remarks: remarks || '',
          reviewedById: req.user.id,
          reviewedAt: new Date(),
        },
      })
      .catch((e) => {
        if (e.code === 'P2025') return null;
        throw e;
      });
    if (!profile) return res.status(404).json({ message: 'Profile not found' });

    await auditLog({
      user: req.user,
      action: 'Reviewed Residence Profile',
      details: `Resident: ${profile.fullName}, Status: ${status}${remarks ? `, Remarks: ${remarks}` : ''}`,
    });

    const s = status.toLowerCase();
    if (s === 'approved' || s === 'under review') {
      const { email, contactNumber } = await contactFor(profile);

      console.log(`[review] Notifying — status: ${s}, email: ${email}, phone: ${contactNumber}`);

      const name = profile.fullName || 'Resident';

      let emailHtml, smsText, emailSubject;

      if (s === 'approved') {
        emailSubject = 'Registration Approved – iRequestDologon';
        emailHtml = `<p>Dear <strong>${name}</strong>,</p>
           <p>Your registration with <strong>Barangay Dologon</strong> has been
           <strong style="color:#156D07">approved</strong>. You are now a verified resident.</p>
           <p>You may now use the iRequestDologon app to request barangay documents.</p>
           <p style="color:#888;font-size:12px">Barangay Dologon – iRequestDologon</p>`;
        smsText = `Hi ${name}, your Barangay Dologon registration has been APPROVED. You can now request documents via iRequestDologon. -Brgy. Dologon`;
      } else {
        emailSubject = 'Verification Under Review – iRequestDologon';
        emailHtml = `<p>Dear <strong>${name}</strong>,</p>
           <p>Your verification profile with <strong>Barangay Dologon</strong> is now
           <strong style="color:#1D6DB5">under review</strong>.</p>
           <p>Our team is currently reviewing your submitted information and documents.
           You will receive another notification once a final decision has been made.</p>
           <p>If you have questions, please visit the Barangay Office.</p>
           <p style="color:#888;font-size:12px">Barangay Dologon – iRequestDologon</p>`;
        smsText = `Hi ${name}, your Barangay Dologon verification is now UNDER REVIEW. We will notify you once a decision has been made. -Brgy. Dologon`;
      }

      if (email) {
        sendEmail({ to: email, subject: emailSubject, html: emailHtml })
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

    res.json(toApi(profile));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
