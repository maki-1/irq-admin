const axios = require('axios');
const prisma = require('../../lib/prisma');
const { isUuid } = require('../../lib/ids');
const { clientOriginFor } = require('../../lib/clientOrigin');

// POST /api/payments/paymongo/checkout
exports.createPayMongoSession = async (req, res) => {
  try {
    const { documentId, amount, documentType } = req.body;
    // Return to whichever allowlisted portal started the checkout — see
    // lib/clientOrigin.js.
    const clientUrl = clientOriginFor(req);
    const response = await axios.post(
      'https://api.paymongo.com/v1/checkout_sessions',
      {
        data: {
          attributes: {
            line_items: [
              {
                currency: 'PHP',
                amount: amount,
                name: documentType,
                quantity: 1,
              },
            ],
            payment_method_types: ['gcash', 'card'],
            success_url: `${clientUrl}/payment/success?documentId=${documentId}`,
            cancel_url: `${clientUrl}/payment/cancel`,
          },
        },
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const session = response.data.data;
    await prisma.payment.create({
      data: {
        // This route is behind admin auth, so the actor is staff, not a
        // resident — recorded in adminId rather than userId. See the Payment
        // model comment.
        adminId: req.user.id,
        documentId: isUuid(documentId) ? documentId : null,
        documentType,
        amount: amount / 100,
        provider: 'paymongo',
        sessionId: session.id,
        status: 'pending',
      },
    });

    res.json({ checkoutUrl: session.attributes.checkout_url, sessionId: session.id });
  } catch (err) {
    res.status(500).json({ message: err.response?.data?.errors?.[0]?.detail || err.message });
  }
};

// POST /api/payments/paymongo/webhook  – PayMongo sends payment events here
exports.payMongoWebhook = async (req, res) => {
  try {
    const event = req.body.data;
    if (event.attributes.type === 'checkout_session.payment.paid') {
      const sessionId = event.attributes.data.attributes.checkout_session_id;

      const existing = await prisma.payment.findFirst({ where: { sessionId } });
      const payment = existing
        ? await prisma.payment.update({
            where: { id: existing.id },
            data: { status: 'paid' },
            include: { requests: { select: { id: true } } },
          })
        : null;

      if (payment) {
        if (payment.documentId) {
          await prisma.document.update({
            where: { id: payment.documentId },
            data: { paymentStatus: 'Paid' },
          });
          // NOTE: the original code also ran a Request update keyed on the
          // *document* id. Documents and requests have separate id spaces, so
          // that never matched anything. Kept as a no-op updateMany rather than
          // a single update, which would now throw instead of matching zero rows.
          await prisma.request.updateMany({
            where: { id: payment.documentId },
            data: { paymentStatus: 'paid', amountPaid: payment.amount },
          });
        }
        // Handle resident pay-approved flow (uses the requests relation)
        if (payment.requests?.length) {
          await prisma.request.updateMany({
            where: { id: { in: payment.requests.map((r) => r.id) } },
            data: { paymentStatus: 'paid', status: 'Processing', amountPaid: payment.amount },
          });
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
