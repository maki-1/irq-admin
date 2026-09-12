const crypto   = require('crypto');
const prisma   = require('../../lib/prisma');
const { toApi } = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');
const auditLog = require('../utils/auditLog');
const sendEmail = require('../utils/sendEmail');
const sendSms   = require('../utils/sendSms');

function generateClaimCode() {
  return 'CLM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

const USER_SELECT = {
  id: true, username: true, email: true, contactNumber: true, avatar: true,
};

const PROFILE_SELECT = {
  id: true, userId: true, fullName: true, age: true, address: true, gender: true,
  contactNumber: true, email: true, fatherName: true, motherName: true,
  civilStatus: true, occupation: true, nationality: true, idType: true,
  idName: true, birthday: true, yearsAtAddress: true, facePhoto: true,
};

// The Mongo version fetched profiles separately and matched them to requests by
// user id *or* email, because `VerificationProfile.user` was optional. It is a
// required relation here, so the profile comes back through the join and the
// email fallback is no longer reachable.
const REQUEST_INCLUDE = {
  user: {
    select: { ...USER_SELECT, verificationProfile: { select: PROFILE_SELECT } },
  },
};

// Preserves the old response shape: `profile` alongside the request, and `user`
// without the nested profile.
function shape(request) {
  const obj = toApi(request);
  const profile = obj.user?.verificationProfile ?? null;
  if (obj.user) delete obj.user.verificationProfile;
  obj.profile = profile;
  return obj;
}

// GET /api/requests
exports.getAll = async (req, res) => {
  try {
    const requests = await prisma.request.findMany({
      include: REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests.map(shape));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/requests/:id
exports.getOne = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Request not found' });
    const request = await prisma.request.findUnique({
      where: { id: req.params.id },
      include: REQUEST_INCLUDE,
    });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    res.json(shape(request));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/requests/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Request not found' });

    let request = await prisma.request
      .update({
        where: { id: req.params.id },
        data: { status },
        include: REQUEST_INCLUDE,
      })
      .catch((e) => {
        if (e.code === 'P2025') return null;
        throw e;
      });
    if (!request) return res.status(404).json({ message: 'Request not found' });

    await auditLog({
      user: req.user,
      action: 'Update Request Status',
      details: `Request ID: ${request.id}, Document: ${request.documentType}, New Status: ${status}`,
    });

    // When marked Completed, create a CompletedDocument record with a claim code
    if (String(status).toLowerCase() === 'completed') {
      const alreadyDone = await prisma.completedDocument.findFirst({
        where: { requestId: request.id },
      });
      if (!alreadyDone) {
        const profile = request.user?.verificationProfile ?? null;
        const claimCode = generateClaimCode();

        await prisma.completedDocument.create({
          data: {
            requestId:    request.id,
            userId:       request.userId,
            documentType: request.documentType,
            purpose:      request.purpose,
            claimCode,
            fullName:     profile?.fullName || request.user?.username || null,
            age:          profile?.age ?? null,
            purok:        (profile?.address || '').split(',')[0].replace(/^Purok\s+/i, '').trim(),
            address:      profile?.address || '',
          },
        });

        // Write claimCode back to the Request so the resident can see it
        request = await prisma.request.update({
          where: { id: request.id },
          data: { claimCode },
          include: REQUEST_INCLUDE,
        });

        // Gather contact info — profile first, fall back to the user record
        const email         = profile?.email         || request.user?.email || null;
        const contactNumber = profile?.contactNumber || request.user?.contactNumber || null;
        const name          = profile?.fullName      || request.user?.username || 'Resident';
        const docType       = request.documentType   || 'document';

        console.log(`[completed] Notifying — email: ${email}, phone: ${contactNumber}`);

        const emailHtml = `
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your <strong>${docType}</strong> is now ready for claiming at the Barangay Dologon Administration Hall.</p>
          <p>Please bring the following when you claim:</p>
          <ul>
            <li>Your <strong>Claim Code: <span style="font-size:16px;letter-spacing:2px">${claimCode}</span></strong></li>
            <li>Your <strong>Purok Clearance</strong></li>
          </ul>
          <p>Office hours: Monday – Friday, 8:00 AM – 5:00 PM.</p>
          <p style="color:#888;font-size:12px">Barangay Dologon – iRequestDologon</p>`;

        const smsText = `Hi ${name}, your ${docType} is ready! Claim it at Brgy. Dologon Hall. Present your Claim Code: ${claimCode} and your Purok Clearance. Mon-Fri 8AM-5PM. -Brgy. Dologon`;

        if (email) {
          sendEmail({ to: email, subject: `Your ${docType} is Ready for Claiming – iRequestDologon`, html: emailHtml })
            .then(() => console.log(`[completed] Email sent to ${email}`))
            .catch((e) => console.error(`[completed] Email failed (${email}):`, e.message));
        } else {
          console.warn('[completed] No email found — skipping email notification');
        }

        if (contactNumber) {
          sendSms({ to: contactNumber, message: smsText })
            .then(() => console.log(`[completed] SMS sent to ${contactNumber}`))
            .catch((e) => console.error(`[completed] SMS failed (${contactNumber}):`, e.message));
        } else {
          console.warn('[completed] No contact number found — skipping SMS notification');
        }
      }
    }

    res.json(shape(request));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/requests/:id/collect-payment — Collector records a cash payment
//
// Kiosk-only. A kiosk resident is standing in the barangay office with no
// reason to pay online, and their purok clearance already proves the Purok
// Leader's part is settled — cash at the counter is the natural next step.
// A web/app request keeps its existing online-only path (payApproved →
// PayMongo): letting a Collector wave one through in cash here would bypass
// that resident's own payment step, which this endpoint is not meant to do.
// This mirrors payApproved's amount (document price + any still-owed purok
// clearance fee) but records it as a cash collection instead of starting a
// checkout session.
exports.collectPayment = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Request not found' });

    const request = await prisma.request.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.channel !== 'kiosk') {
      return res.status(400).json({ message: 'Cash collection is only available for kiosk walk-ins. This request must be paid online.' });
    }
    if (request.purokLeaderStatus !== 'approved') {
      return res.status(400).json({ message: 'This request has not been approved by the Purok Leader yet.' });
    }
    if (request.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'This request is already paid.' });
    }
    if (request.paymentStatus === 'free') {
      return res.status(400).json({ message: 'This document is free — there is nothing to collect.' });
    }

    const priceDoc = await prisma.documentPrice.findUnique({
      where: { documentType: request.documentType },
    });
    const docCentavos = priceDoc ? priceDoc.pricecentavos : 10000;
    // purokClearanceFee is a Decimal; kiosk-issued requests already have it
    // zeroed (paid in cash to the Purok Leader), so this only adds anything
    // for an online-channel request the leader approved with a fee attached.
    const purokFeeCentavos = Math.round(Number(request.purokClearanceFee || 0) * 100);
    const totalPesos = (docCentavos + purokFeeCentavos) / 100;

    const [updated] = await prisma.$transaction([
      prisma.request.update({
        where: { id: request.id },
        data: { paymentStatus: 'paid', status: 'Processing', amountPaid: totalPesos },
        include: REQUEST_INCLUDE,
      }),
      prisma.payment.create({
        data: {
          adminId: req.user.id,
          userId: request.userId,
          documentType: request.documentType,
          amount: totalPesos,
          provider: 'manual',
          status: 'paid',
          requests: { connect: [{ id: request.id }] },
        },
      }),
    ]);

    await auditLog({
      user: req.user,
      action: 'Collected Cash Payment',
      details: `Request ${request.id} (${request.documentType}) — ₱${totalPesos.toFixed(2)} collected in cash`,
    });

    res.json(shape(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
