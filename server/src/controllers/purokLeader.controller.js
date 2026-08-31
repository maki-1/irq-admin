const prisma     = require('../../lib/prisma');
const { toApi }  = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');
const auditLog   = require('../utils/auditLog');

const USER_BRIEF = { select: { id: true, username: true, email: true, contactNumber: true } };

/* Helper — get user IDs whose verification profile address contains the purok */
async function getUserIdsForPurok(purok) {
  if (!purok) return [];
  // Was a case-insensitive regex; `contains` with insensitive mode is the
  // equivalent for a plain substring match.
  const profiles = await prisma.verificationProfile.findMany({
    where: { address: { contains: purok, mode: 'insensitive' } },
    select: { userId: true },
  });
  return profiles.map((p) => p.userId).filter(Boolean);
}

/* GET /api/purok-leader/dashboard */
exports.getDashboard = async (req, res) => {
  try {
    const purok   = req.user.purok;
    const userIds = await getUserIdsForPurok(purok);

    const requests = await prisma.request.findMany({
      where: { userId: { in: userIds } },
      select: { purokLeaderStatus: true, documentType: true },
    });

    const stats = {
      total:    requests.length,
      pending:  requests.filter((r) => r.purokLeaderStatus === 'pending').length,
      approved: requests.filter((r) => r.purokLeaderStatus === 'approved').length,
      rejected: requests.filter((r) => r.purokLeaderStatus === 'rejected').length,
      byType:   {},
    };

    requests.forEach((r) => {
      if (r.documentType) {
        stats.byType[r.documentType] = (stats.byType[r.documentType] || 0) + 1;
      }
    });

    res.json({ purok, residents: userIds.length, stats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* GET /api/purok-leader/requests */
exports.getRequests = async (req, res) => {
  try {
    const purok   = req.user.purok;
    const userIds = await getUserIdsForPurok(purok);

    const requests = await prisma.request.findMany({
      where: { userId: { in: userIds } },
      include: {
        user: {
          select: {
            ...USER_BRIEF.select,
            verificationProfile: { select: { id: true, userId: true, fullName: true, address: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Preserves the old shape: `profile` beside the request rather than nested
    // inside `user`.
    const result = requests.map((r) => {
      const obj = toApi(r);
      const profile = obj.user?.verificationProfile ?? null;
      if (obj.user) delete obj.user.verificationProfile;
      obj.profile = profile;
      return obj;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* PATCH /api/purok-leader/requests/:id/approve */
exports.approveRequest = async (req, res) => {
  try {
    const { remarks } = req.body;
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Request not found' });

    // Find the request to get the resident's user ID
    const existing = await prisma.request.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!existing) return res.status(404).json({ message: 'Request not found' });

    // Look up resident's address from their verification profile
    const profile = await prisma.verificationProfile.findUnique({
      where: { userId: existing.userId },
      select: { address: true },
    });
    const residentAddress = profile?.address || '';

    // Match address against all purok clearance fees
    let purokClearanceFee = 0;
    if (residentAddress) {
      const allFees = await prisma.purokClearanceFee.findMany();
      const matched = allFees.find((fee) =>
        new RegExp(fee.purokName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(residentAddress)
      );
      purokClearanceFee = matched ? matched.feecentavos / 100 : 0;
    }

    const request = await prisma.request.update({
      where: { id: req.params.id },
      data: {
        purokLeaderStatus:  'approved',
        purokLeaderBy:      req.user.id,
        purokLeaderAt:      new Date(),
        purokLeaderRemarks: remarks || '',
        purokClearanceFee,
      },
      include: { user: { select: { id: true, username: true, email: true } } },
    });

    await auditLog({
      user: req.user,
      action: 'Purok Leader Approve Request',
      details: `Request ${request.id} (${request.documentType}) approved by ${req.user.fullName} — Purok Clearance Fee: ₱${purokClearanceFee}`,
    });

    res.json(toApi(request));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* PATCH /api/purok-leader/requests/:id/reject */
exports.rejectRequest = async (req, res) => {
  try {
    const { remarks } = req.body;
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Request not found' });

    const request = await prisma.request
      .update({
        where: { id: req.params.id },
        data: {
          purokLeaderStatus:  'rejected',
          purokLeaderBy:      req.user.id,
          purokLeaderAt:      new Date(),
          purokLeaderRemarks: remarks || '',
          status:             'Rejected',
        },
        include: { user: { select: { id: true, username: true, email: true } } },
      })
      .catch((e) => {
        if (e.code === 'P2025') return null;
        throw e;
      });

    if (!request) return res.status(404).json({ message: 'Request not found' });

    await auditLog({
      user: req.user,
      action: 'Purok Leader Reject Request',
      details: `Request ${request.id} (${request.documentType}) rejected by ${req.user.fullName}. Reason: ${remarks || 'none'}`,
    });

    res.json(toApi(request));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
