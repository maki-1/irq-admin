const { shapeRequest } = require('../../lib/requestStatus');
const prisma = require('../../lib/prisma');
const { isAccountActive } = require('../../lib/accountLifecycle');
const { toApi } = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');
const { verify } = require('../../lib/approveLink');
const { purokFeeCentavosForUser } = require('../../lib/purokFee');
const auditLog = require('../utils/auditLog');
const { userIdsForPurok } = require('../../lib/purokScope');

// Resolve the leader behind a signed link (from the email one-tap button), plus
// the user ids in their purok. Everything below is scoped to that set, so a link
// can only ever touch the leader's own queue.
async function leaderFromParams(params) {
  const leaderId = verify(params);
  if (!leaderId || !isUuid(leaderId)) return null;
  const leader = await prisma.admin.findUnique({
    where: { id: leaderId },
    select: { id: true, fullName: true, purok: true, role: true, active: true, sessionVersion: true },
  });
  if (!isAccountActive(leader) || leader.role !== 'Purok Leader' || leader.sessionVersion !== Number(params.v)) return null;

  const userIds = await userIdsForPurok(leader.purok, prisma);
  return { leader, userIds };
}

// GET /api/purok-approve/pending?lid=&exp=&sig=&v=
exports.getPending = async (req, res) => {
  try {
    const ctx = await leaderFromParams(req.query);
    if (!ctx) return res.status(401).json({ ok: false, message: 'This approval link is invalid or has expired.' });

    const requests = await prisma.request.findMany({
      where: { userId: { in: ctx.userIds }, purokLeaderStatus: 'pending' },
      include: {
        completedDocuments: true,
        user: { select: { username: true, verificationProfile: { select: { fullName: true, address: true } } } },
      },
      orderBy: [{ channel: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({
      ok: true,
      leader: { fullName: ctx.leader.fullName, purok: ctx.leader.purok },
      requests: requests.map((r) => {
        const o = toApi(shapeRequest(r));
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

// POST /api/purok-approve/action  { lid, exp, sig, v, requestId, action, remarks }
exports.act = async (req, res) => {
  try {
    const { lid, exp, sig, v, requestId, action, remarks } = req.body || {};
    const ctx = await leaderFromParams({ lid, exp, sig, v });
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
    const data = {
      purokLeaderStatus: action === 'approve' ? 'approved' : 'rejected',
      purokLeaderBy: ctx.leader.id,
      purokLeaderAt: new Date(),
      purokLeaderRemarks: remarks || (action === 'approve' ? 'Approved' : 'Rejected') + ' via ' + via,
      ...(action === 'approve'
        ? { purokClearanceFee: (await purokFeeCentavosForUser(existing.userId)) / 100 }
        : { status: 'Rejected' }),
    };
    const request = await prisma.$transaction(async tx => {
      const result = await tx.request.updateMany({
        where: { id: requestId, userId: { in: ctx.userIds }, purokLeaderStatus: 'pending' },
        data,
      });
      if (result.count !== 1) {
        throw Object.assign(new Error('This request was already decided. Refresh the queue.'), { status: 409 });
      }
      const updated = await tx.request.findUnique({ where: { id: requestId } });
      await auditLog({
        user: { id: ctx.leader.id, fullName: ctx.leader.fullName, role: 'Purok Leader' },
        action: 'Purok Leader ' + (action === 'approve' ? 'Approve' : 'Reject') + ' Request (' + via + ')',
        details: 'Request ' + updated.id + ' (' + updated.documentType + ') ' + action + 'd via ' + via,
      }, tx);
      return updated;
    });

    res.json({ ok: true, action, request: toApi(request) });
  } catch (err) {
    res.status(err.status === 409 ? 409 : 500).json({ ok: false, message: err.message });
  }
};
