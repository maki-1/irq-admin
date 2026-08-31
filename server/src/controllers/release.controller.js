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
          select: { id: true, documentType: true, purpose: true, paymentStatus: true, createdAt: true },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    res.json(toApi(docs));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/releases/:id/claim-status
exports.updateClaimStatus = async (req, res) => {
  try {
    const { claimStatus } = req.body;
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Record not found' });

    const doc = await prisma.completedDocument
      .update({ where: { id: req.params.id }, data: { claimStatus } })
      .catch((e) => {
        if (e.code === 'P2025') return null;
        throw e;
      });
    if (!doc) return res.status(404).json({ message: 'Record not found' });

    // Keep Request.status in sync so the resident app shows the correct tab.
    // 'Claimed' and 'Completed' are outside the Flutter backend's four statuses,
    // which is why requests.status is a free-form string rather than an enum.
    if (doc.requestId) {
      if (claimStatus === 'claimed') {
        await prisma.request.update({ where: { id: doc.requestId }, data: { status: 'Claimed' } });
      } else if (claimStatus === 'pending') {
        await prisma.request.update({ where: { id: doc.requestId }, data: { status: 'Completed' } });
      }
    }

    res.json(toApi(doc));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
