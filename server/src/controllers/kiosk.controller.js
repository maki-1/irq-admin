const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../../lib/prisma');
const { toApi } = require('../../lib/serialize');
const { verifyClearance, redeemClearance } = require('../../lib/purokClearance');
const generateORNumber = require('../utils/generateORNumber');
const { notifyPurokLeader } = require('../../lib/purokNotify');
const sendSmsRaw = require('../utils/sendSms');
const sendEmail = require('../utils/sendEmail');

/**
 * Walk-in kiosk.
 *
 * A resident arrives at the barangay office holding a purok clearance their
 * Purok Leader issued earlier (fee already paid in cash). They type its control
 * number, pick documents, and submit — no login, no live approval. The
 * clearance IS the attestation: redeeming it stamps the new requests as
 * approved by the issuing leader, with a zero purok-clearance fee.
 *
 * Requests made through the app or website never touch this controller; they
 * keep the in-app per-request approval.
 */

// The shared notifier calls sendSms(to, message); the util takes an object.
const sendSms = (to, message) => sendSmsRaw({ to, message });

const DOCUMENT_TYPES = [
  'Barangay Clearance',
  'Certificate of Residency',
  'Certificate of Indigency',
];

// Same fallback the resident-facing flow uses (resident.payment.controller.js)
// when a document type has no row in document_prices.
const FALLBACK_CENTAVOS = {
  'Certificate of Residency': 5000,
  'Certificate of Indigency': 0,
};

// The purok clearance only covers the Purok Leader's own fee, settled in cash
// at issuance — it is not the price of the document itself. That still has to
// be paid, in cash, at the barangay Collector's counter (see
// request.controller.js `collectPayment`), since a kiosk resident is already
// on-site rather than paying online like the app/portal flow.
async function priceCentavosFor(documentType, client = prisma) {
  const priceDoc = await client.documentPrice.findUnique({ where: { documentType } });
  if (priceDoc) return priceDoc.pricecentavos;
  return FALLBACK_CENTAVOS[documentType] ?? 10000; // default ₱100
}

// Fire-and-forget: a resident is standing at the counter, so tell their Purok
// Leader a request is waiting. `channel:'kiosk'` makes purokNotify mark them as
// physically present. Never allowed to fail the submission.
function announceToPurokLeader(userId, documentTypes) {
  notifyPurokLeader({ userId, documentTypes, channel: 'kiosk', sendSms, sendEmail })
    .then((r) => {
      if (!r.notified) console.warn(`[kiosk] purok leader not notified: ${r.reason}`);
    })
    .catch((e) => console.error('[kiosk] notify failed:', e.message));
}

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);

/**
 * Resolves the resident account a kiosk request belongs to.
 *
 * `Request.userId` is required, but a clearance can be issued to a true walk-in
 * with no account (`purokClearance.userId` is null). In that case we provision
 * a minimal, already-verified resident record from the clearance snapshot — the
 * Purok Leader attested to this person face to face — and link it back to the
 * clearance so a later real signup can be reconciled.
 *
 * The account is born without a usable password; the resident would set one via
 * the normal password-reset flow if they ever want to log in.
 */
async function resolveKioskUser(clearance) {
  if (clearance.userId) return clearance.userId;

  const digits = String(clearance.contactNumber || '').replace(/\D/g, '');
  const base = slugify(clearance.fullName) || 'resident';

  for (let attempt = 0; attempt < 5; attempt++) {
    const username = `${base}-${crypto.randomBytes(3).toString('hex')}`;
    // First try the resident's real number; on a clash fall back to a
    // deterministic, obviously non-dialable placeholder (the column is
    // UNIQUE NOT NULL). The control number is itself unique.
    const contactNumber =
      attempt === 0 && digits.length >= 7 ? digits : `KIOSK-${clearance.controlNo}`;

    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username,
            contactNumber,
            password: await bcrypt.hash(crypto.randomUUID(), 10),
            isVerified: true,
            verificationStatus: 'approved',
            verificationStep: 3,
          },
        });

        await tx.verificationProfile.create({
          data: {
            userId: user.id,
            fullName: clearance.fullName || '',
            address: clearance.address || '',
            birthday: clearance.birthday || null,
            purok: clearance.purok || null,
            contactNumber: digits || null,
            currentStep: 3,
            status: 'approved',
          },
        });

        await tx.purokClearance.update({
          where: { id: clearance.id },
          data: { userId: user.id },
        });

        return user.id;
      });
    } catch (err) {
      // Username/contact-number race — try again with a fresh username.
      if (err.code === 'P2002') continue;
      throw err;
    }
  }

  throw new Error('Could not provision a resident account for this clearance');
}

// ── POST /api/kiosk/clearance/verify ────────────────────────────────────────
// Checks a control number before the resident picks documents, so a bad code is
// caught at the first screen. An unusable clearance is an expected outcome
// here, not a fault: it comes back 200 with ok:false and a message the screen
// shows verbatim.
exports.verifyClearance = async (req, res) => {
  try {
    const { controlNo, birthday, surname } = req.body || {};
    if (!controlNo) {
      return res.status(400).json({ message: 'Enter your purok clearance control number' });
    }

    const result = await verifyClearance({ controlNo, birthday, surname });
    if (!result.ok) {
      return res.json({ ok: false, reason: result.reason, message: result.message });
    }

    const c = result.clearance;
    res.json({
      ok: true,
      clearance: {
        // Enough to confirm the right person — not a lookup terminal for a
        // neighbour's details.
        controlNo: c.controlNo,
        purok: c.purok,
        fullName: c.fullName,
        validUntil: c.validUntil,
        feePaid: c.feePaid,
      },
    });
  } catch (err) {
    console.error('[kiosk] verify failed:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── POST /api/kiosk/requests ────────────────────────────────────────────────
// One submission, one clearance, one or more documents.
exports.submitRequests = async (req, res) => {
  try {
    const { controlNo, birthday, surname, items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Choose at least one document' });
    }
    for (const item of items) {
      if (!DOCUMENT_TYPES.includes(item?.documentType)) {
        return res.status(400).json({ message: `Invalid document type: ${item?.documentType}` });
      }
      if (!item.purpose || !String(item.purpose).trim()) {
        return res.status(400).json({ message: 'Each document needs a purpose' });
      }
    }

    // Re-check server-side; never trust the client's earlier verify.
    const result = await verifyClearance({ controlNo, birthday, surname });
    if (!result.ok) {
      return res.status(400).json({ ok: false, reason: result.reason, message: result.message });
    }
    const clearance = result.clearance;

    const userId = await resolveKioskUser(clearance);

    // Sequential: each create draws the next OR number from the shared counter.
    const created = [];
    for (const item of items) {
      const priceCentavos = await priceCentavosFor(item.documentType);
      created.push(
        await prisma.request.create({
          data: {
            userId,
            documentType: item.documentType,
            purpose: String(item.purpose).trim(),
            additionalDetails: item.additionalDetails ? String(item.additionalDetails) : '',
            deliveryMethod: 'Pick up at Barangay Office',
            status: 'Pending',
            // Only free when the document's own price is actually ₱0 — the
            // purok clearance fee is a separate charge, already settled with
            // the Purok Leader, and never substitutes for the document fee.
            paymentStatus: priceCentavos === 0 ? 'free' : 'unpaid',
            amountPaid: priceCentavos / 100,
            requestPhoto: '',
            purokLeaderStatus: 'pending',
            orNumber: await generateORNumber(),
            channel: 'kiosk',
          },
        })
      );
    }
    const createdIds = created.map((r) => r.id);

    // Spend the clearance on this submission. Conditional on it still being
    // unused, so two kiosks cannot redeem the same code at once. redeemClearance
    // also stamps these requests as approved (by the issuing leader, at issue
    // time) with a zero purok-clearance fee.
    const spend = await redeemClearance(clearance.id, createdIds);
    if (!spend.ok) {
      // Lost the race. Remove the requests we just made rather than leaving them
      // unapproved and unpayable.
      await prisma.request.deleteMany({ where: { id: { in: createdIds } } });
      return res.status(409).json({
        ok: false,
        reason: 'already_used',
        message: 'This clearance was just used. Please obtain a new one from your Purok Leader.',
      });
    }

    const requests = await prisma.request.findMany({
      where: { id: { in: createdIds } },
      orderBy: { createdAt: 'asc' },
    });

    // What's still owed, in pesos — the document fee(s), collectible in cash
    // at the barangay Collector's counter. Zero once every document is free.
    const totalDue = requests
      .filter((r) => r.paymentStatus === 'unpaid')
      .reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);

    res.status(201).json({
      ok: true,
      controlNo: clearance.controlNo,
      requests: toApi(requests),
      totalDue,
    });

    announceToPurokLeader(userId, requests.map((r) => r.documentType));
  } catch (err) {
    console.error('[kiosk] submit failed:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
