const prisma = require('../../lib/prisma');
const { toApi } = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');
const { verify } = require('../../lib/approveLink');
const { purokFeeCentavosForUser } = require('../../lib/purokFee');
const auditLog = require('../utils/auditLog');

// Resolve the leader behind a signed link (from the email one-tap button), plus
// the user ids in their purok. Everything below is scoped to that set, so a link
// can only ever touch the leader's own queue.
async function leaderFromParams(params) {
  const leaderId = verify(params);
  if (!leaderId || !isUuid(leaderId)) return null;
  const leader = await prisma.admin.findUnique({
    where: { id: leaderId },
    select: { id: true, fullName: true, purok: true, role: true, active: true },
  });
  if (!leader || leader.role !== 'Purok Leader' || leader.active === false) return null;

  const profiles = await prisma.verificationProfile.findMany({
    where: {
      OR: [
        { purok: { equals: leader.purok, mode: 'insensitive' } },
        { AND: [{ purok: null }, { address: { contains: leader.purok, mode: 'insensitive' } }] },
      ],
    },
    select: { userId: true },
  });
  const userIds = profiles.map((p) => p.userId).filter(Boolean);
  return { leader, userIds };
}

// GET /api/purok-approve/pending?lid=&exp=&sig=
exports.getPending = async (req, res) => {
  try {
    const ctx = await leaderFromParams(req.query);
    if (!ctx) return res.status(401).json({ ok: false, message: 'This approval link is invalid or has expired.' });

    const requests = await prisma.request.findMany({
      where: { userId: { in: ctx.userIds }, purokLeaderStatus: 'pending' },
      include: {
        user: { select: { username: true, verificationProfile: { select: { fullName: true, address: true } } } },
      },
      orderBy: [{ channel: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({
      ok: true,
      leader: { fullName: ctx.leader.fullName, purok: ctx.leader.purok },
      requests: requests.map((r) => {
        const o = toApi(r);
        o.residentName = r.user?.verificationProfile?.fullName || r.user?.username || 'A resident';
        o.residentAddress = r.user?.verificationProfile?.address || '';
        delete o.user;
        return o;
      }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// POST /api/purok-approve/action  { lid, exp, sig, requestId, action, remarks }
exports.act = async (req, res) => {
  try {
    const { lid, exp, sig, requestId, action, remarks } = req.body || {};
    const ctx = await leaderFromParams({ lid, exp, sig });
    if (!ctx) return res.status(401).json({ ok: false, message: 'This approval link is invalid or has expired.' });
    if (!isUuid(requestId)) return res.status(404).json({ ok: false, message: 'Request not found.' });
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ ok: false, message: 'Invalid action.' });
    }

    // The request must belong to this leader's purok and still be pending.
    const existing = await prisma.request.findFirst({
      where: { id: requestId, userId: { in: ctx.userIds } },
      select: { id: true, userId: true, documentType: true, purokLeaderStatus: true },
    });
    if (!existing) return res.status(404).json({ ok: false, message: 'Request not found for your purok.' });
    if (existing.purokLeaderStatus !== 'pending') {
      return res.status(409).json({ ok: false, message: `This request was already ${existing.purokLeaderStatus}.` });
    }

    const via = 'email link';
    let request;
    if (action === 'approve') {
      const feecentavos = await purokFeeCentavosForUser(existing.userId);
      request = await prisma.request.update({
        where: { id: requestId },
        data: {
          purokLeaderStatus: 'approved',
          purokLeaderBy: ctx.leader.id,
          purokLeaderAt: new Date(),
          purokLeaderRemarks: remarks || `Approved via ${via}`,
          purokClearanceFee: feecentavos / 100,
        },
      });
    } else {
      request = await prisma.request.update({
        where: { id: requestId },
        data: {
          purokLeaderStatus: 'rejected',
          purokLeaderBy: ctx.leader.id,
          purokLeaderAt: new Date(),
          purokLeaderRemarks: remarks || `Rejected via ${via}`,
        },
      });
    }

    await auditLog({
      user: { id: ctx.leader.id, fullName: ctx.leader.fullName, role: 'Purok Leader' },
      action: `Purok Leader ${action === 'approve' ? 'Approve' : 'Reject'} Request (${via})`,
      details: `Request ${request.id} (${request.documentType}) ${action}d via ${via}`,
    });

    res.json({ ok: true, action, request: toApi(request) });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};
