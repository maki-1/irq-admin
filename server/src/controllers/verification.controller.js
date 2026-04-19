const VerificationProfile = require('../models/VerificationProfile');

// GET /api/verifications/stats
exports.getStats = async (req, res) => {
  try {
    const [total, pending] = await Promise.all([
      VerificationProfile.countDocuments(),
      VerificationProfile.countDocuments({ status: { $in: ['pending', 'Pending'] } }),
    ]);
    res.json({ total, pending });
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
      {
        status,
        rejectionReason: remarks || '',
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
      },
      { new: true }
    );
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
