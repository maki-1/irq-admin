const CompletedDocument = require('../models/CompletedDocument');
require('../models/ResidentUser');

// GET /api/releases
exports.getAll = async (req, res) => {
  try {
    const docs = await CompletedDocument.find()
      .populate('user', 'username email contactNumber')
      .populate('request', 'documentType purpose paymentStatus createdAt')
      .sort({ completedAt: -1 });

    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/releases/:id/claim-status
exports.updateClaimStatus = async (req, res) => {
  try {
    const { claimStatus } = req.body;
    const doc = await CompletedDocument.findByIdAndUpdate(
      req.params.id,
      { claimStatus },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
