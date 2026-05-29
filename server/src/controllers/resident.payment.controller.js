const axios    = require('axios');
const cloudinary = require('../config/cloudinary');
const Request  = require('../models/Request');
const Payment  = require('../models/Payment');
const PurokClearanceFee = require('../models/PurokClearanceFee');
const VerificationProfile = require('../models/VerificationProfile');
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

/* ── POST /api/payment/create-session ───────────────────── */
exports.createSession = async (req, res) => {
  try {
    const userId = req.resident._id;
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
    const pendingRequests = [];
    let totalCentavos = 0;

    for (let j = 0; j < docs.length; j++) {
      const doc = docs[j];
      let requestPhotoUrl = null;
      const fileArr = req.files?.[`documents[${j}][photo]`];
      if (fileArr?.[0]) {
        requestPhotoUrl = await uploadBuffer(fileArr[0].buffer, 'irequestd/clearance');
      }

      // Get price from document-prices collection or use defaults
      const { DocumentPrice } = require('../models/DocumentPrice') || {};
      let priceInCentavos = 10000; // default ₱100 in centavos
      try {
        const DocumentPriceModel = require('../models/DocumentPrice');
        const priceDoc = await DocumentPriceModel.findOne({ documentType: doc.type });
        if (priceDoc) priceInCentavos = priceDoc.pricecentavos;
        else {
          if (doc.type === 'Certificate of Residency') priceInCentavos = 5000;
          if (doc.type === 'Certificate of Indigency') priceInCentavos = 0;
        }
      } catch {}

      totalCentavos += priceInCentavos;

      const orNumber = await generateORNumber();
      const request = await Request.create({
        user:               userId,
        documentType:       doc.type,
        purpose:            doc.purpose,
        additionalDetails:  doc.details || '',
        status:             'Pending',
        paymentStatus:      priceInCentavos === 0 ? 'free' : 'unpaid',
        amountPaid:         priceInCentavos / 100,
        requestPhoto:       requestPhotoUrl,
        purokLeaderStatus:  'pending',
        orNumber,
      });
      pendingRequests.push(request._id.toString());
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
    const userId    = req.resident._id;
    const requestId = req.params.id;

    const request = await Request.findOne({ _id: requestId, user: userId });
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
    let docCentavos = 10000;
    try {
      const DocumentPriceModel = require('../models/DocumentPrice');
      const priceDoc = await DocumentPriceModel.findOne({ documentType: request.documentType });
      if (priceDoc) docCentavos = priceDoc.pricecentavos;
    } catch {}

    const purokFeeCentavos = Math.round((request.purokClearanceFee || 0) * 100);
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

    await Payment.create({
      user:         userId,
      documentType: request.documentType,
      amount:       totalCentavos / 100,
      provider:     'paymongo',
      sessionId:    session.id,
      status:       'pending',
      requests:     [requestId],
    });

    await Request.findByIdAndUpdate(requestId, { paymentLinkId: session.id });

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
    const userId    = req.resident._id;
    const requestId = req.params.requestId;

    const request = await Request.findOne({ _id: requestId, user: userId });
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
      await Request.findByIdAndUpdate(requestId, {
        paymentStatus: 'paid',
        status:        'Processing',
      });
      // Also mark the Payment record if it exists
      await Payment.findOneAndUpdate(
        { sessionId: request.paymentLinkId },
        { status: 'paid' }
      );
      return res.json({ paid: true, status: 'Processing' });
    }

    res.json({ paid: false, intentStatus, sessionStatus });
  } catch (err) {
    console.error('[verifyPayment]', err.response?.data || err.message);
    res.status(500).json({ message: err.message });
  }
};
