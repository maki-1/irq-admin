const VerificationProfile = require('../models/VerificationProfile');

// GET /api/verifications  — list all (Secretary / Captain)
exports.getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const profiles = await VerificationProfile.find(filter)
      .populate('reviewedBy', 'fullName role')
      .sort({ createdAt: -1 });
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/verifications/:id  — single profile detail
exports.getOne = async (req, res) => {
  try {
    const profile = await VerificationProfile.findById(req.params.id)
      .populate('reviewedBy', 'fullName role');
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/verifications  — client submits profile (public or auth)
exports.create = async (req, res) => {
  try {
    const profile = await VerificationProfile.create(req.body);
    res.status(201).json(profile);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PATCH /api/verifications/:id/review  — Secretary updates status + remarks
exports.review = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const allowed = ['Under Review', 'Verified', 'Rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}` });
    }
    const profile = await VerificationProfile.findByIdAndUpdate(
      req.params.id,
      {
        status,
        remarks: remarks || '',
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
      },
      { new: true }
    ).populate('reviewedBy', 'fullName role');
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
