const axios = require('axios');
const Payment = require('../models/Payment');
const Document = require('../models/Document');

// POST /api/payments/paymongo/checkout
exports.createPayMongoSession = async (req, res) => {
  try {
    const { documentId, amount, documentType } = req.body;
    const response = await axios.post(
      'https://api.paymongo.com/v1/checkout_sessions',
      {
        data: {
          attributes: {
            line_items: [
              {
                currency: 'PHP',
                amount: amount * 100,
                name: documentType,
                quantity: 1,
              },
            ],
            payment_method_types: ['gcash', 'card'],
            success_url: `${process.env.CLIENT_URL}/payment/success?documentId=${documentId}`,
            cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
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
    await Payment.create({
      user: req.user._id,
      document: documentId,
      documentType,
      amount,
      provider: 'paymongo',
      sessionId: session.id,
      status: 'pending',
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
      const payment = await Payment.findOneAndUpdate(
        { sessionId },
        { status: 'paid' },
        { new: true }
      );
      if (payment) {
        await Document.findByIdAndUpdate(payment.document, { paymentStatus: 'Paid' });
      }
    }
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
