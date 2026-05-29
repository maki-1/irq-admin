const Request             = require('../models/Request');
const VerificationProfile = require('../models/VerificationProfile');
const PurokClearanceFee   = require('../models/PurokClearanceFee');
const auditLog            = require('../utils/auditLog');
require('../models/ResidentUser');

/* Helper — get user IDs whose verification profile address contains the purok */
async function getUserIdsForPurok(purok) {
  const profiles = await VerificationProfile.find({
    address: { $regex: purok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
  }).select('user').lean();
  return profiles.map((p) => p.user).filter(Boolean);
}

/* GET /api/purok-leader/dashboard */
exports.getDashboard = async (req, res) => {
  try {
    const purok   = req.user.purok;
    const userIds = await getUserIdsForPurok(purok);

    const requests = await Request.find({ user: { $in: userIds } }).lean();

    const stats = {
      total:    requests.length,
      pending:  requests.filter((r) => r.purokLeaderStatus === 'pending').length,
      approved: requests.filter((r) => r.purokLeaderStatus === 'approved').length,
      rejected: requests.filter((r) => r.purokLeaderStatus === 'rejected').length,
      byType:   {},
    };

    requests.forEach((r) => {
      if (r.documentType) {
        stats.byType[r.documentType] = (stats.byType[r.documentType] || 0) + 1;
      }
    });

    res.json({ purok, residents: userIds.length, stats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* GET /api/purok-leader/requests */
exports.getRequests = async (req, res) => {
  try {
    const purok   = req.user.purok;
    const userIds = await getUserIdsForPurok(purok);

    const requests = await Request.find({ user: { $in: userIds } })
      .populate('user', 'username email contactNumber')
      .sort({ createdAt: -1 })
      .lean();

    // Attach verification profiles
    const profiles = await VerificationProfile.find({ user: { $in: userIds } })
      .select('user fullName address').lean();
    const profileMap = {};
    profiles.forEach((p) => { profileMap[p.user?.toString()] = p; });

    const result = requests.map((r) => ({
      ...r,
      profile: profileMap[r.user?._id?.toString() || r.user?.toString()] || null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* PATCH /api/purok-leader/requests/:id/approve */
exports.approveRequest = async (req, res) => {
  try {
    const { remarks } = req.body;
    const purok = req.user.purok;

    // Get the purok clearance fee for this leader's purok
    const feeDoc = await PurokClearanceFee.findOne({
      purokName: { $regex: purok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
    }).lean();
    const purokClearanceFee = feeDoc ? feeDoc.feecentavos / 100 : 0;

    const request = await Request.findByIdAndUpdate(
      req.params.id,
      {
        purokLeaderStatus:  'approved',
        purokLeaderBy:      req.user._id,
        purokLeaderAt:      new Date(),
        purokLeaderRemarks: remarks || '',
        purokClearanceFee,
      },
      { new: true }
    ).populate('user', 'username email');

    if (!request) return res.status(404).json({ message: 'Request not found' });

    await auditLog({
      user: req.user,
      action: 'Purok Leader Approve Request',
      details: `Request ${request._id} (${request.documentType}) approved by ${req.user.fullName} — Purok Clearance Fee: ₱${purokClearanceFee}`,
    });

    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* PATCH /api/purok-leader/requests/:id/reject */
exports.rejectRequest = async (req, res) => {
  try {
    const { remarks } = req.body;

    const request = await Request.findByIdAndUpdate(
      req.params.id,
      {
        purokLeaderStatus:  'rejected',
        purokLeaderBy:      req.user._id,
        purokLeaderAt:      new Date(),
        purokLeaderRemarks: remarks || '',
        status:             'Rejected',
      },
      { new: true }
    ).populate('user', 'username email');

    if (!request) return res.status(404).json({ message: 'Request not found' });

    await auditLog({
      user: req.user,
      action: 'Purok Leader Reject Request',
      details: `Request ${request._id} (${request.documentType}) rejected by ${req.user.fullName}. Reason: ${remarks || 'none'}`,
    });

    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
