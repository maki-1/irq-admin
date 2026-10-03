const { canonicalDocuments, RELEASE_REQUEST_SELECT } = require('../../lib/requestStatus');
const { setClaimStatus } = require('../../lib/requestWorkflow');
const prisma = require('../../lib/prisma');
const { toApi } = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');

// GET /api/releases
exports.getAll = async (req, res) => {
  try {
    const docs = await prisma.completedDocument.findMany({
      include: {
        user: { select: { id: true, username: true, email: true, contactNumber: true } },
        request: {
          select: RELEASE_REQUEST_SELECT,
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    res.json(toApi(canonicalDocuments(docs)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/releases/:id/claim-status
exports.updateClaimStatus = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Record not found' });
    const doc = await setClaimStatus(prisma, req.params.id, req.body.claimStatus);
    res.json(toApi(canonicalDocuments([doc])[0]));
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};
