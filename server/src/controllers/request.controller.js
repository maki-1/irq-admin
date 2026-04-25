const crypto              = require('crypto');
const Request             = require('../models/Request');
const VerificationProfile = require('../models/VerificationProfile');
const CompletedDocument   = require('../models/CompletedDocument');
require('../models/ResidentUser'); // must be registered before Request.populate('user') runs

function generateClaimCode() {
  return 'CLM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

/* Attach verificationProfile to each request object */
async function attachProfiles(requests) {
  const userIds = requests
    .map(r => r.user?._id ?? r.user)
    .filter(Boolean);

  const profiles = await VerificationProfile.find({ user: { $in: userIds } })
    .select('user fullName age address gender purok contactNumber email');

  const vpMap = {};
  profiles.forEach(vp => { vpMap[vp.user.toString()] = vp.toObject(); });

  return requests.map(r => {
    const obj = r.toObject ? r.toObject() : { ...r };
    const uid = (r.user?._id ?? r.user)?.toString();
    obj.profile = uid ? (vpMap[uid] ?? null) : null;
    return obj;
  });
}

// GET /api/requests
exports.getAll = async (req, res) => {
  try {
    const requests = await Request.find()
      .populate('user', 'username email contactNumber avatar')
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
      .populate('user', 'username email contactNumber avatar');
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
    ).populate('user', 'username email contactNumber avatar');
    if (!request) return res.status(404).json({ message: 'Request not found' });

    // When marked Completed, create a CompletedDocument record with a claim code
    if (status.toLowerCase() === 'completed') {
      const alreadyDone = await CompletedDocument.findOne({ request: request._id });
      if (!alreadyDone) {
        const profile = await VerificationProfile.findOne({ user: request.user._id })
          .select('fullName age purok address');

        await CompletedDocument.create({
          request:      request._id,
          user:         request.user._id,
          documentType: request.documentType,
          purpose:      request.purpose,
          claimCode:    generateClaimCode(),
          fullName:     profile?.fullName  || request.user.username,
          age:          profile?.age       || null,
          purok:        profile?.purok     || '',
          address:      profile?.address   || '',
        });
      }
    }

    const [result] = await attachProfiles([request]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
