const prisma = require('../../lib/prisma');
const { toApi } = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');
const { nextControlNo, DEFAULT_VALID_DAYS } = require('../../lib/purokClearance');
const { resolvePurokFee } = require('../../lib/purokFee');
const auditLog = require('../utils/auditLog');

/**
 * Purok clearance issuance — the Purok Leader's own tab.
 *
 * The resident calls at the leader's house, pays the fee in cash, and leaves
 * with a control number they later type at the kiosk. Issuing is the moment the
 * attestation happens, so it is restricted to the leader of that purok.
 */

const ISSUED_SHAPE = {
  id: true, controlNo: true, purok: true, fullName: true, address: true,
  birthday: true, contactNumber: true, feecentavos: true, feePaid: true,
  issuedAt: true, validUntil: true, status: true, usedAt: true, userId: true,
};

/* GET /api/purok-clearance/issued — clearances this leader has issued */
exports.listIssued = async (req, res) => {
  try {
    const { status } = req.query;
    const clearances = await prisma.purokClearance.findMany({
      where: {
        issuedById: req.user.id,
        ...(status ? { status } : {}),
      },
      select: { ...ISSUED_SHAPE, requests: { select: { id: true, documentType: true } } },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    });
    res.json(toApi(clearances));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* GET /api/purok-clearance/residents?q= — find an existing resident to link */
exports.searchResidents = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);

    const profiles = await prisma.verificationProfile.findMany({
      where: {
        purok: { equals: req.user.purok, mode: 'insensitive' },
        fullName: { contains: q, mode: 'insensitive' },
      },
      select: {
        userId: true, fullName: true, address: true, birthday: true, contactNumber: true,
        user: { select: { contactNumber: true } },
      },
      take: 20,
      orderBy: { fullName: 'asc' },
    });

    res.json(
      toApi(
        profiles.map((p) => ({
          userId: p.userId,
          fullName: p.fullName,
          address: p.address,
          birthday: p.birthday,
          contactNumber: p.contactNumber || p.user?.contactNumber || null,
        }))
      )
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* POST /api/purok-clearance/issue */
exports.issue = async (req, res) => {
  try {
    const purok = req.user.purok;
    if (!purok) {
      return res.status(400).json({
        message: 'Your account has no purok assigned, so it cannot issue clearances.',
      });
    }

    const { fullName, address, birthday, contactNumber, userId, feePaid, validDays } = req.body;

    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ message: "The resident's full name is required" });
    }
    if (!address || !String(address).trim()) {
      return res.status(400).json({ message: "The resident's address is required" });
    }
    // The kiosk asks for a birth date or a surname alongside the control
    // number. A clearance issued without a birth date can only ever be
    // redeemed by surname, which is much weaker — so it is required here.
    if (!birthday) {
      return res.status(400).json({
        message: 'Birth date is required — the kiosk uses it to confirm the holder',
      });
    }
    const parsedBirthday = new Date(birthday);
    if (Number.isNaN(parsedBirthday.getTime())) {
      return res.status(400).json({ message: 'Invalid birth date' });
    }

    // A leader may only issue for a resident who belongs to their own purok.
    if (userId) {
      if (!isUuid(userId)) return res.status(400).json({ message: 'Invalid resident' });
      const profile = await prisma.verificationProfile.findUnique({
        where: { userId },
        select: { purok: true, fullName: true },
      });
      if (!profile) return res.status(404).json({ message: 'Resident not found' });
      if ((profile.purok || '').toLowerCase() !== purok.toLowerCase()) {
        return res.status(403).json({
          message: `${profile.fullName} is not in ${purok} — only their own Purok Leader may issue their clearance.`,
        });
      }
    }

    const { feecentavos } = await resolvePurokFee(purok);

    const days = Number(validDays) > 0 ? Number(validDays) : DEFAULT_VALID_DAYS;
    const validUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const clearance = await prisma.purokClearance.create({
      data: {
        controlNo: await nextControlNo(),
        purok,
        issuedById: req.user.id,
        userId: userId || null,
        fullName: String(fullName).trim(),
        address: String(address).trim(),
        birthday: parsedBirthday,
        contactNumber: contactNumber ? String(contactNumber).replace(/\D/g, '') : null,
        feecentavos,
        // Cash is handed over at the purok leader's house, so it is paid unless
        // they say otherwise.
        feePaid: feePaid === undefined ? true : Boolean(feePaid),
        validUntil,
      },
      select: ISSUED_SHAPE,
    });

    await auditLog({
      user: req.user,
      action: 'Issued Purok Clearance',
      details: `${clearance.controlNo} for ${clearance.fullName} (${purok}) — ₱${feecentavos / 100}`,
    });

    res.status(201).json(toApi(clearance));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* PATCH /api/purok-clearance/:id/void */
exports.voidClearance = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Clearance not found' });
    const { reason } = req.body || {};

    const clearance = await prisma.purokClearance.findUnique({ where: { id: req.params.id } });
    if (!clearance) return res.status(404).json({ message: 'Clearance not found' });
    if (clearance.issuedById !== req.user.id) {
      return res.status(403).json({ message: 'You can only cancel clearances you issued' });
    }
    if (clearance.status === 'used') {
      return res.status(400).json({
        message: 'This clearance has already been used and cannot be cancelled.',
      });
    }

    const updated = await prisma.purokClearance.update({
      where: { id: clearance.id },
      data: { status: 'void' },
      select: ISSUED_SHAPE,
    });

    await auditLog({
      user: req.user,
      action: 'Cancelled Purok Clearance',
      details: `${clearance.controlNo} for ${clearance.fullName}${reason ? ` — ${reason}` : ''}`,
    });

    res.json(toApi(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
