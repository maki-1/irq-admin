const prisma = require('../../lib/prisma');
const { toApi } = require('../../lib/serialize');

/* GET /api/purok-clearance/all-fees */
exports.getAll = async (req, res) => {
  try {
    const fees = await prisma.purokClearanceFee.findMany({ orderBy: { purokName: 'asc' } });
    res.json(toApi(fees));
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
    const data = {
      purokName,
      feecentavos: Math.round(Number(feecentavos)),
      updatedBy,
      ...(description    !== undefined && { description }),
      ...(purokPresident !== undefined && { purokPresident }),
      ...(treasurerName  !== undefined && { treasurerName }),
    };

    // The Mongo version matched purokName case-insensitively via regex, but the
    // Postgres unique index is case-sensitive — so the lookup is done first and
    // the row updated by id, rather than using a plain upsert on purokName.
    const existing = await prisma.purokClearanceFee.findFirst({
      where: { purokName: { equals: purokName, mode: 'insensitive' } },
    });

    const doc = existing
      ? await prisma.purokClearanceFee.update({ where: { id: existing.id }, data })
      : await prisma.purokClearanceFee.create({ data });

    res.json(toApi(doc));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
