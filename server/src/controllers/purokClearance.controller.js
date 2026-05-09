const PurokClearanceFee = require('../models/PurokClearanceFee');

// GET /api/purok-clearance/puroks
exports.getPuroks = async (req, res) => {
  try {
    const puroks = await PurokClearanceFee.distinct('purokName');
    res.json(puroks.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/purok-clearance/my-fee
exports.getMyFee = async (req, res) => {
  try {
    const fee = await PurokClearanceFee.findOne({ purokName: req.user.purok });
    if (!fee) return res.status(404).json({ message: 'No fee configuration found for your purok.' });
    res.json(fee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/purok-clearance/my-fee
exports.updateMyFee = async (req, res) => {
  try {
    const { feecentavos, description, purokPresident, treasurerName } = req.body;
    const fee = await PurokClearanceFee.findOneAndUpdate(
      { purokName: req.user.purok },
      { feecentavos, description, purokPresident, treasurerName, updatedBy: req.user.fullName },
      { new: true }
    );
    if (!fee) return res.status(404).json({ message: 'No fee configuration found for your purok.' });
    res.json(fee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
