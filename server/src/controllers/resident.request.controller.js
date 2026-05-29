const cloudinary  = require('../config/cloudinary');
const Request          = require('../models/Request');
const CompletedDocument = require('../models/CompletedDocument');
const ResidentUser = require('../models/ResidentUser');
const VerificationProfile = require('../models/VerificationProfile');
const DocumentPrice = require('../models/DocumentPrice');
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
    const userId = req.resident._id;
    const requests = await Request.find({ user: userId }).lean();

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
    const userId = req.resident._id;
    const requests = await Request.find({ user: userId }).sort({ createdAt: -1 }).lean();
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/requests/claimed ──────────────────────────── */
exports.getClaimed = async (req, res) => {
  try {
    const userId = req.resident._id;
    const requests = await Request.find({ user: userId, status: 'Claimed' })
      .sort({ updatedAt: -1 }).lean();
    res.json(requests);
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
    const userId = req.resident._id;
    const filter = { user: userId };
    if (req.query.status) filter.claimStatus = req.query.status;

    const docs = await CompletedDocument.find(filter)
      .populate('request', 'documentType purpose paymentStatus orNumber controlNumber createdAt')
      .sort({ completedAt: -1 })
      .lean();

    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── DELETE /api/requests/:id ───────────────────────────── */
exports.deleteRequest = async (req, res) => {
  try {
    const userId = req.resident._id;
    const request = await Request.findOne({ _id: req.params.id, user: userId });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending requests can be deleted' });
    }
    await Request.findByIdAndDelete(req.params.id);
    res.json({ message: 'Request deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/requests/bulk (free requests) ────────────── */
exports.createBulk = async (req, res) => {
  try {
    const userId  = req.resident._id;
    const resident = req.resident;

    // Parse documents array from multipart body
    const documents = [];
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

    // Upload purok clearance photos
    const photos = req.files?.photo || req.files?.['documents[0][photo]'] || [];
    const photoFields = Object.keys(req.files || {}).filter((k) => k.includes('photo'));

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
      const request = await Request.create({
        user:               userId,
        documentType:       doc.type,
        purpose:            doc.purpose,
        additionalDetails:  doc.details || '',
        status:             'Pending',
        paymentStatus:      'free',
        amountPaid:         0,
        requestPhoto:       requestPhotoUrl,
        purokLeaderStatus:  'pending',
        orNumber,
      });
      created.push(request);
    }

    res.status(201).json({ message: 'Requests submitted', requests: created });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
