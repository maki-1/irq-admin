const prisma = require('../../lib/prisma');
const { toApi } = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');

// GET /api/document-prices
exports.getAll = async (req, res) => {
  try {
    const prices = await prisma.documentPrice.findMany({ orderBy: { documentType: 'asc' } });
    res.json(toApi(prices));
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
    if (!isUuid(req.params.id)) {
      return res.status(404).json({ message: 'Document price not found.' });
    }

    const updatedBy = req.user?.fullName || req.user?.email || 'admin';
    const updated = await prisma.documentPrice
      .update({
        where: { id: req.params.id },
        data: {
          pricecentavos: Math.round(Number(pricecentavos)),
          updatedBy,
          ...(description !== undefined && { description }),
        },
      })
      .catch((e) => {
        if (e.code === 'P2025') return null;
        throw e;
      });

    if (!updated) return res.status(404).json({ message: 'Document price not found.' });
    res.json(toApi(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
