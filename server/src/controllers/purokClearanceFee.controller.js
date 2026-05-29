const PurokClearanceFee = require('../models/PurokClearanceFee');

/* GET /api/purok-clearance/all-fees */
exports.getAll = async (req, res) => {
  try {
    const fees = await PurokClearanceFee.find().sort({ purokName: 1 });
    res.json(fees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* PUT /api/purok-clearance/:purokName — upsert fee for a purok */
exports.upsert = async (req, res) => {
  try {
    const { purokName } = req.params;
    const { feecentavos, description, purokPresident, treasurerName } = req.body;

    if (feecentavos === undefined || feecentavos < 0) {
      return res.status(400).json({ message: 'Fee must be a non-negative number.' });
    }

    const updatedBy = req.user?.fullName || req.user?.email || 'admin';
    const doc = await PurokClearanceFee.findOneAndUpdate(
      { purokName: { $regex: `^${purokName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
      {
        purokName,
        feecentavos: Math.round(Number(feecentavos)),
        updatedBy,
        ...(description    !== undefined && { description }),
        ...(purokPresident !== undefined && { purokPresident }),
        ...(treasurerName  !== undefined && { treasurerName }),
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
