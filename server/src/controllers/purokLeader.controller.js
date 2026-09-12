const prisma     = require('../../lib/prisma');
const { toApi }  = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');
const { purokFeeCentavosForUser } = require('../../lib/purokFee');
const auditLog   = require('../utils/auditLog');

const USER_BRIEF = { select: { id: true, username: true, email: true, contactNumber: true } };

/* Which verification profiles belong to a purok.
 *
 * Prefers the stored `purok` field. The address `contains` match is kept only
 * as a fallback for profiles predating that column, and is deliberately narrow:
 * a substring test on address matches "Purok 20" for a leader of "Purok 2".
 *
 * Every purok-scoped query goes through this one clause, so the roster and the
 * request queue can never disagree about who belongs to a leader's purok.
 */
function purokProfileWhere(purok) {
  return {
    OR: [
      { purok: { equals: purok, mode: 'insensitive' } },
      { AND: [{ purok: null }, { address: { contains: purok, mode: 'insensitive' } }] },
    ],
  };
}

async function getUserIdsForPurok(purok) {
  if (!purok) return [];
  const profiles = await prisma.verificationProfile.findMany({
    where: purokProfileWhere(purok),
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

/* GET /api/purok-leader/residents
 *
 * The roster of residents in the signed-in leader's own purok. The purok comes
 * from req.user, never from the query string: a leader must not be able to read
 * another purok's residents by asking for one.
 *
 * Deliberately a narrower projection than the Secretary's /verifications list.
 * A Purok Leader attests that someone lives in their purok, which needs names,
 * addresses, contacts and exemption flags — not ID scans, face photos or the AI
 * verification output, so those are not selected here at all.
 */
exports.getResidents = async (req, res) => {
  try {
    const purok = req.user.purok;
    if (!purok) {
      return res.status(400).json({
        message: 'No purok is assigned to your account. Ask the Barangay Captain to set one.',
      });
    }

    const profiles = await prisma.verificationProfile.findMany({
      where: purokProfileWhere(purok),
      select: {
        id: true,
        userId: true,
        fullName: true,
        address: true,
        purok: true,
        birthday: true,
        age: true,
        gender: true,
        yearsAtAddress: true,
        yearsOfResidency: true,
        contactNumber: true,
        email: true,
        isPwd: true,
        isSenior: true,
        isIndigent: true,
        currentStep: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        createdAt: true,
        // Contact details live on the resident account when the profile was
        // filled in without them — see the fallback below.
        user: { select: { id: true, username: true, email: true, contactNumber: true, avatar: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const residents = profiles.map((p) => {
      const obj = toApi(p);
      const user = obj.user || null;
      delete obj.user;
      return {
        ...obj,
        username: user?.username || null,
        avatar: user?.avatar || '',
        // The profile's own copies are near-always blank; the account is where
        // these actually live. Falling back here keeps the roster usable
        // instead of showing a column of dashes.
        contactNumber: obj.contactNumber || user?.contactNumber || null,
        email: obj.email || user?.email || null,
        // Two columns record the same thing under different names — the int one
        // holds essentially all the data, the text one a couple of old rows.
        yearsAtAddress: obj.yearsAtAddress ?? (obj.yearsOfResidency ? Number(obj.yearsOfResidency) || null : null),
      };
    });

    res.json({ purok, total: residents.length, residents });
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
      // Kiosk requests mean a resident is standing at the counter waiting, so
      // they sort above everything else regardless of age.
      orderBy: [{ channel: 'asc' }, { createdAt: 'desc' }],
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

    // Resolve the clearance fee from the resident's purok. Shared with the
    // Flutter backend via lib/purokFee.js so the amount quoted to the resident
    // and the amount charged here cannot drift apart. It reads the stored
    // `purok` field, falling back to matching the address only for profiles
    // created before that column existed.
    const feecentavos = await purokFeeCentavosForUser(existing.userId);
    const purokClearanceFee = feecentavos / 100;

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
