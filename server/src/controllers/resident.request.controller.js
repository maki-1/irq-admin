const { STATUS, shapeRequest, residentDocuments, residentSummary } = require('../../lib/requestStatus');
const cloudinary = require('../config/cloudinary');
const prisma     = require('../../lib/prisma');
const { toApi }  = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');
const { notifyPurokLeader } = require('../../lib/purokNotify');
const { normalizePurpose } = require('../../lib/purpose');
const generateORNumber = require('../utils/generateORNumber');
const sendSmsRaw = require('../utils/sendSms');
const sendEmail = require('../utils/sendEmail');

// The shared notifier calls sendSms(to, message); this util takes an object.
const sendSms = (to, message) => sendSmsRaw({ to, message });

// A new request cannot be paid for until the Purok Leader approves it, and
// nothing used to tell them it was waiting. Fired after the response is sent so
// a slow gateway never delays the resident.
function announceToPurokLeader(userId, documentTypes, channel) {
  notifyPurokLeader({ userId, documentTypes, channel, sendSms, sendEmail })
    .then((r) => {
      if (!r.notified) console.warn(`[requests] purok leader not notified: ${r.reason}`);
    })
    .catch((e) => console.error('[requests] notify failed:', e.message));
}

async function uploadBuffer(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(buffer);
  });
}

/* ── GET /api/requests/summary ──────────────────────────── */
exports.getSummary = async (req, res) => {
  try {
    res.json(toApi(await residentSummary(prisma, req.resident.id)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/requests ──────────────────────────────────── */
exports.getMyRequests = async (req, res) => {
  try {
    const requests = await prisma.request.findMany({
      where: { userId: req.resident.id },
      include: { completedDocuments: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(toApi(requests.map(shapeRequest)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/requests/claimed ──────────────────────────── */
exports.getClaimed = async (req, res) => {
  try {
    const docs = await residentDocuments(prisma, req.resident.id);
    res.json(toApi(docs.filter((doc) => doc.status === STATUS.claimed)));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── GET /api/my/requests/completed ────────────────────────
   Returns the resident's CompletedDocument records.
   ?status=pending  → ready-for-pickup
   ?status=claimed  → already claimed
   (no param = all)
────────────────────────────────────────────────────────── */
exports.getMyCompleted = async (req, res) => {
  try {
    const filter = req.query.status?.toLowerCase();
    if (filter && !['pending', 'claimed'].includes(filter)) return res.status(400).json({ message: 'Status must be pending or claimed.' });
    const docs = await residentDocuments(prisma, req.resident.id);
    res.json(toApi(filter ? docs.filter((doc) => doc.claimStatus === filter) : docs));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/* ── DELETE /api/requests/:id ───────────────────────────── */
exports.deleteRequest = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Request not found' });

    const request = await prisma.request.findFirst({
      where: { id: req.params.id, userId: req.resident.id },
    });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending requests can be deleted' });
    }
    await prisma.request.delete({ where: { id: request.id } });
    res.json({ message: 'Request deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/requests/bulk (free requests) ────────────── */
exports.createBulk = async (req, res) => {
  try {
    const userId = req.resident.id;

    const body = req.body;

    // Support both JSON body and multipart array syntax
    let docs = [];
    if (Array.isArray(body.documents)) {
      docs = body.documents;
    } else {
      // Multipart sends documents[0][type], documents[0][purpose], etc.
      let i = 0;
      while (body[`documents[${i}][type]`] !== undefined) {
        docs.push({
          type:    body[`documents[${i}][type]`],
          purpose: body[`documents[${i}][purpose]`],
          details: body[`documents[${i}][details]`] || '',
          photoIndex: i,
        });
        i++;
      }
    }

    if (!docs.length) return res.status(400).json({ message: 'No documents provided' });

    // A purpose of "Other" is only accepted with the resident's own 1-2 word
    // answer, which is what gets stored and printed on the certificate.
    for (const doc of docs) {
      const checkedPurpose = normalizePurpose(doc.purpose);
      if (!checkedPurpose.ok) return res.status(400).json({ message: checkedPurpose.message });
      doc.purpose = checkedPurpose.value;
    }

    const created = [];
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];

      let requestPhotoUrl = null;
      // Try to get per-document photo
      const fieldKey = `documents[${i}][photo]`;
      const fileArr = req.files?.[fieldKey];
      if (fileArr?.[0]) {
        requestPhotoUrl = await uploadBuffer(fileArr[0].buffer, 'irequestd/clearance');
      }

      const orNumber = await generateORNumber();
      const request = await prisma.request.create({
        data: {
          userId,
          documentType:       doc.type,
          purpose:            doc.purpose,
          additionalDetails:  doc.details || '',
          status:             'Pending',
          paymentStatus:      'free',
          amountPaid:         0,
          // Column is non-nullable; the old model allowed null here.
          requestPhoto:       requestPhotoUrl ?? '',
          purokLeaderStatus:  'pending',
          orNumber,
          channel:            body.channel === 'kiosk' ? 'kiosk' : 'web',
        },
      });
      created.push(request);
    }

    res.status(201).json({ message: 'Requests submitted', requests: toApi(created) });
    // One notification for the batch, not one per document.
    announceToPurokLeader(userId, created.map((r) => r.documentType), created[0]?.channel);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
