const DocumentPrice = require('../models/DocumentPrice');

// GET /api/document-prices
exports.getAll = async (req, res) => {
  try {
    const prices = await DocumentPrice.find().sort({ documentType: 1 });
    res.json(prices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/document-prices/:id
exports.update = async (req, res) => {
  try {
    const { pricecentavos, description } = req.body;
    if (pricecentavos === undefined || pricecentavos < 0) {
      return res.status(400).json({ message: 'Price must be a non-negative number.' });
    }
    const updatedBy = req.user?.fullName || req.user?.email || 'admin';
    const updated = await DocumentPrice.findByIdAndUpdate(
      req.params.id,
      {
        pricecentavos: Math.round(Number(pricecentavos)),
        updatedBy,
        ...(description !== undefined && { description }),
      },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Document price not found.' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
