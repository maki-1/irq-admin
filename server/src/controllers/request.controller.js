const crypto              = require('crypto');
const Request             = require('../models/Request');
const VerificationProfile = require('../models/VerificationProfile');
const CompletedDocument   = require('../models/CompletedDocument');
const auditLog            = require('../utils/auditLog');
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
        .select('user fullName age address gender purok contactNumber email fatherName motherName civilStatus occupation nationality idType idName dateOfBirth')
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
        }).select('fullName age purok address').lean();

        await CompletedDocument.create({
          request:      request._id,
          user:         request.user._id,
          documentType: request.documentType,
          purpose:      request.purpose,
          claimCode:    generateClaimCode(),
          fullName:     profile?.fullName || request.user.username,
          age:          profile?.age      ?? null,
          purok:        profile?.purok    || (profile?.address || '').split(',')[0].replace(/^Purok\s+/i, '').trim(),
          address:      profile?.address  || '',
        });
      }
    }

    const [result] = await attachProfiles([request]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
