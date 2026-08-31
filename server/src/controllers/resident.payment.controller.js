const axios      = require('axios');
const cloudinary = require('../config/cloudinary');
const prisma     = require('../../lib/prisma');
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

const PAYMONGO_AUTH = () =>
  `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`;

// Falls back to the same hardcoded defaults the original used when a document
// type has no row in document_prices.
const FALLBACK_CENTAVOS = {
  'Certificate of Residency': 5000,
  'Certificate of Indigency': 0,
};

async function priceCentavosFor(documentType) {
  const priceDoc = await prisma.documentPrice.findUnique({ where: { documentType } });
  if (priceDoc) return priceDoc.pricecentavos;
  return FALLBACK_CENTAVOS[documentType] ?? 10000; // default ₱100
}

/* ── POST /api/payment/create-session ───────────────────── */
exports.createSession = async (req, res) => {
  try {
    const userId = req.resident.id;
    const body   = req.body;

    // Parse documents array from multipart
    const docs = [];
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

    // Fallback: handle nested-array format (e.g. from JSON body)
    if (!docs.length && Array.isArray(body.documents)) {
      body.documents.forEach((doc, idx) => {
        if (doc?.type) docs.push({ type: doc.type, purpose: doc.purpose || '', details: doc.details || '', photoIndex: idx });
      });
    }

    if (!docs.length) return res.status(400).json({ message: 'No documents provided' });

    // Upload photos and create pending requests
    for (let j = 0; j < docs.length; j++) {
      const doc = docs[j];
      let requestPhotoUrl = null;
      const fileArr = req.files?.[`documents[${j}][photo]`];
      if (fileArr?.[0]) {
        requestPhotoUrl = await uploadBuffer(fileArr[0].buffer, 'irequestd/clearance');
      }

      const priceInCentavos = await priceCentavosFor(doc.type);

      const orNumber = await generateORNumber();
      await prisma.request.create({
        data: {
          userId,
          documentType:       doc.type,
          purpose:            doc.purpose,
          additionalDetails:  doc.details || '',
          status:             'Pending',
          paymentStatus:      priceInCentavos === 0 ? 'free' : 'unpaid',
          amountPaid:         priceInCentavos / 100,
          // Column is non-nullable; the old model allowed null here.
          requestPhoto:       requestPhotoUrl ?? '',
          purokLeaderStatus:  'pending',
          orNumber,
        },
      });
    }

    // All requests require purok leader approval before payment
    return res.json({ message: 'Requests submitted. Waiting for Purok Leader approval.', pendingApproval: true });
  } catch (err) {
    console.error('[createSession]', err.response?.data || err.message);
    res.status(500).json({
      message: err.response?.data?.errors?.[0]?.detail || err.message,
    });
  }
};

/* ── POST /api/payment/pay-approved/:id ─────────────────── */
exports.payApproved = async (req, res) => {
  try {
    const userId    = req.resident.id;
    const requestId = req.params.id;
    if (!isUuid(requestId)) return res.status(404).json({ message: 'Request not found' });

    const request = await prisma.request.findFirst({ where: { id: requestId, userId } });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.purokLeaderStatus !== 'approved') {
      return res.status(400).json({ message: 'Request not yet approved by Purok Leader' });
    }
    if (request.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Already paid' });
    }
    if (request.paymentStatus === 'free') {
      return res.json({ message: 'This document is free', free: true });
    }

    // Document price (in centavos)
    const priceDoc = await prisma.documentPrice.findUnique({
      where: { documentType: request.documentType },
    });
    const docCentavos = priceDoc ? priceDoc.pricecentavos : 10000;

    // purokClearanceFee is a Prisma Decimal — coerce before arithmetic.
    const purokFeeCentavos = Math.round(Number(request.purokClearanceFee || 0) * 100);
    const totalCentavos    = docCentavos + purokFeeCentavos;

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5174';

    const response = await axios.post(
      'https://api.paymongo.com/v1/checkout_sessions',
      {
        data: {
          attributes: {
            line_items: [
              { currency: 'PHP', amount: docCentavos,    name: request.documentType, quantity: 1 },
              ...(purokFeeCentavos > 0 ? [{ currency: 'PHP', amount: purokFeeCentavos, name: 'Purok Clearance Fee', quantity: 1 }] : []),
            ],
            payment_method_types: ['gcash', 'card'],
            success_url: `${clientUrl}/payment/success?refs=${requestId}&sid={{SESSION_ID}}`,
            cancel_url:  `${clientUrl}/payment/cancel`,
            description: `iRequestD — ${request.documentType}`,
          },
        },
      },
      { headers: { Authorization: PAYMONGO_AUTH(), 'Content-Type': 'application/json' } }
    );

    const session = response.data.data;

    await prisma.payment.create({
      data: {
        userId,
        documentType: request.documentType,
        amount:       totalCentavos / 100,
        provider:     'paymongo',
        sessionId:    session.id,
        status:       'pending',
        requests:     { connect: [{ id: requestId }] },
        legacyRequestIds: [],
      },
    });

    await prisma.request.update({
      where: { id: requestId },
      data: { paymentLinkId: session.id },
    });

    res.json({
      checkoutUrl: session.attributes.checkout_url,
      sessionId:   session.id,
    });
  } catch (err) {
    console.error('[payApproved]', err.response?.data || err.message);
    res.status(500).json({
      message: err.response?.data?.errors?.[0]?.detail || err.message,
    });
  }
};

/* ── GET /api/payment/verify/:requestId ─────────────────── */
exports.verifyPayment = async (req, res) => {
  try {
    const userId    = req.resident.id;
    const requestId = req.params.requestId;
    if (!isUuid(requestId)) return res.status(404).json({ message: 'Request not found' });

    const request = await prisma.request.findFirst({ where: { id: requestId, userId } });
    if (!request) return res.status(404).json({ message: 'Request not found' });

    // Already marked paid
    if (request.paymentStatus === 'paid') {
      return res.json({ paid: true, status: request.status });
    }

    // Free requests don't need payment verification
    if (request.paymentStatus === 'free') {
      return res.json({ paid: true, status: request.status });
    }

    // No session ID yet — Pay Now hasn't been called
    if (!request.paymentLinkId) {
      return res.json({ paid: false, reason: 'no_session' });
    }

    // Ask PayMongo directly for the checkout session status
    const pmRes = await axios.get(
      `https://api.paymongo.com/v1/checkout_sessions/${request.paymentLinkId}`,
      { headers: { Authorization: PAYMONGO_AUTH() } }
    );

    const attrs = pmRes.data?.data?.attributes || {};
    const intentStatus  = attrs.payment_intent?.attributes?.status;
    const sessionStatus = attrs.status;
    const isPaid =
      intentStatus  === 'succeeded' ||
      sessionStatus === 'paid'      ||
      sessionStatus === 'completed' ||
      attrs.payment_status === 'paid';

    if (isPaid) {
      await prisma.request.update({
        where: { id: requestId },
        data: { paymentStatus: 'paid', status: 'Processing' },
      });
      // Also mark the Payment record if it exists
      await prisma.payment.updateMany({
        where: { sessionId: request.paymentLinkId },
        data: { status: 'paid' },
      });
      return res.json({ paid: true, status: 'Processing' });
    }

    res.json({ paid: false, intentStatus, sessionStatus });
  } catch (err) {
    console.error('[verifyPayment]', err.response?.data || err.message);
    res.status(500).json({ message: err.message });
  }
};
