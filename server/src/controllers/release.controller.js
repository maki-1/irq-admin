const CompletedDocument = require('../models/CompletedDocument');
const Request           = require('../models/Request');
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

    // Keep Request.status in sync so the resident app shows the correct tab
    if (claimStatus === 'claimed') {
      await Request.findByIdAndUpdate(doc.request, { status: 'Claimed' });
    } else if (claimStatus === 'pending') {
      await Request.findByIdAndUpdate(doc.request, { status: 'Completed' });
    }

    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
