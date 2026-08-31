const cloudinary = require('../config/cloudinary');
const prisma     = require('../../lib/prisma');
const { toApi }  = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');
const generateORNumber = require('../utils/generateORNumber');

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
    const userId = req.resident.id;
    const requests = await prisma.request.findMany({
      where: { userId },
      select: { status: true },
    });

    const summary = { total: requests.length, Pending: 0, Processing: 0, Printing: 0, Completed: 0, Claimed: 0 };
    requests.forEach((r) => {
      if (summary[r.status] !== undefined) summary[r.status]++;
    });

    res.json({ ...summary, total: requests.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/requests ──────────────────────────────────── */
exports.getMyRequests = async (req, res) => {
  try {
    const requests = await prisma.request.findMany({
      where: { userId: req.resident.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(toApi(requests));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/requests/claimed ──────────────────────────── */
exports.getClaimed = async (req, res) => {
  try {
    const requests = await prisma.request.findMany({
      where: { userId: req.resident.id, status: 'Claimed' },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(toApi(requests));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/my/requests/completed ────────────────────────
   Returns the resident's CompletedDocument records.
   ?status=pending  → ready-for-pickup
   ?status=claimed  → already claimed
   (no param = all)
────────────────────────────────────────────────────────── */
exports.getMyCompleted = async (req, res) => {
  try {
    const where = { userId: req.resident.id };
    // Case-insensitive: claim statuses have been written with varying casing.
    if (req.query.status) {
      where.claimStatus = { equals: req.query.status, mode: 'insensitive' };
    }

    const docs = await prisma.completedDocument.findMany({
      where,
      include: {
        request: {
          select: {
            id: true, documentType: true, purpose: true, paymentStatus: true,
            orNumber: true, controlNumber: true, createdAt: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    res.json(toApi(docs));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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
        },
      });
      created.push(request);
    }

    res.status(201).json({ message: 'Requests submitted', requests: toApi(created) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
