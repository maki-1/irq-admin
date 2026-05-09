const crypto              = require('crypto');
const Request             = require('../models/Request');
const VerificationProfile = require('../models/VerificationProfile');
const CompletedDocument   = require('../models/CompletedDocument');
const auditLog            = require('../utils/auditLog');
const sendEmail           = require('../utils/sendEmail');
const sendSms             = require('../utils/sendSms');
require('../models/ResidentUser'); // must be registered before Request.populate('user') runs

function generateClaimCode() {
  return 'CLM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

/* Attach verificationProfile to each request object */
async function attachProfiles(requests) {
  const userIds = requests.map(r => r.user?._id ?? r.user).filter(Boolean);

  // ResidentUser may store email as 'email' or 'gmail' depending on auth provider
  const emails = requests
    .flatMap(r => [r.user?.email, r.user?.gmail])
    .filter(Boolean)
    .map(e => e.toLowerCase());

  const orClauses = [];
  if (userIds.length) orClauses.push({ user: { $in: userIds } });
  if (emails.length)  orClauses.push({ email: { $in: emails } });

  const profiles = orClauses.length
    ? await VerificationProfile.find({ $or: orClauses })
        .select('user fullName age address gender purok contactNumber email fatherName motherName civilStatus occupation nationality idType idName dateOfBirth yearsAtAddress facePhoto')
        .lean()
    : [];

  const byUserId = {};
  const byEmail  = {};
  profiles.forEach(vp => {
    if (vp.user)  byUserId[vp.user.toString()]    = vp;
    if (vp.email) byEmail[vp.email.toLowerCase()] = vp;
  });

  return requests.map(r => {
    const obj   = r.toObject ? r.toObject() : { ...r };
    const uid   = (r.user?._id ?? r.user)?.toString();
    // try both email field names used by the mobile app
    const email = (r.user?.email || r.user?.gmail)?.toLowerCase();
    obj.profile = (uid && byUserId[uid]) || (email && byEmail[email]) || null;
    return obj;
  });
}

// GET /api/requests
exports.getAll = async (req, res) => {
  try {
    const requests = await Request.find()
      .populate('user', 'username email gmail contactNumber avatar')
      .sort({ createdAt: -1 });

    const result = await attachProfiles(requests);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/requests/:id
exports.getOne = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('user', 'username email gmail contactNumber avatar');
    if (!request) return res.status(404).json({ message: 'Request not found' });

    const [result] = await attachProfiles([request]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/requests/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const request = await Request.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('user', 'username email gmail contactNumber avatar');
    if (!request) return res.status(404).json({ message: 'Request not found' });

    await auditLog({
      user: req.user,
      action: 'Update Request Status',
      details: `Request ID: ${request._id}, Document: ${request.documentType}, New Status: ${status}`,
    });

    // When marked Completed, create a CompletedDocument record with a claim code
    if (status.toLowerCase() === 'completed') {
      const alreadyDone = await CompletedDocument.findOne({ request: request._id });
      if (!alreadyDone) {
        const profile = await VerificationProfile.findOne({
          $or: [
            { user:  request.user._id },
            { email: request.user.email?.toLowerCase() },
          ],
        }).select('fullName age purok address contactNumber email').lean();

        const claimCode = generateClaimCode();

        await CompletedDocument.create({
          request:      request._id,
          user:         request.user._id,
          documentType: request.documentType,
          purpose:      request.purpose,
          claimCode,
          fullName:     profile?.fullName || request.user.username,
          age:          profile?.age      ?? null,
          purok:        profile?.purok    || (profile?.address || '').split(',')[0].replace(/^Purok\s+/i, '').trim(),
          address:      profile?.address  || '',
        });

        // Gather contact info — profile first, fall back to ResidentUser fields
        const email         = profile?.email         || request.user.email  || request.user.gmail  || null;
        const contactNumber = profile?.contactNumber || request.user.contactNumber || null;
        const name          = profile?.fullName      || request.user.username || 'Resident';
        const docType       = request.documentType   || 'document';

        console.log(`[completed] Notifying — email: ${email}, phone: ${contactNumber}`);

        const emailHtml = `
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your <strong>${docType}</strong> is now ready for claiming at the Barangay Dologon Administration Hall.</p>
          <p>Please bring the following when you claim:</p>
          <ul>
            <li>Your <strong>Claim Code: <span style="font-size:16px;letter-spacing:2px">${claimCode}</span></strong></li>
            <li>Your <strong>Purok Clearance</strong></li>
          </ul>
          <p>Office hours: Monday – Friday, 8:00 AM – 5:00 PM.</p>
          <p style="color:#888;font-size:12px">Barangay Dologon – iRequestDologon</p>`;

        const smsText = `Hi ${name}, your ${docType} is ready! Claim it at Brgy. Dologon Hall. Present your Claim Code: ${claimCode} and your Purok Clearance. Mon-Fri 8AM-5PM. -Brgy. Dologon`;

        if (email) {
          sendEmail({ to: email, subject: `Your ${docType} is Ready for Claiming – iRequestDologon`, html: emailHtml })
            .then(() => console.log(`[completed] Email sent to ${email}`))
            .catch((e) => console.error(`[completed] Email failed (${email}):`, e.message));
        } else {
          console.warn('[completed] No email found — skipping email notification');
        }

        if (contactNumber) {
          sendSms({ to: contactNumber, message: smsText })
            .then(() => console.log(`[completed] SMS sent to ${contactNumber}`))
            .catch((e) => console.error(`[completed] SMS failed (${contactNumber}):`, e.message));
        } else {
          console.warn('[completed] No contact number found — skipping SMS notification');
        }
      }
    }

    const [result] = await attachProfiles([request]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
