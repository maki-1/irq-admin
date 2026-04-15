const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    documentType: { type: String },
    amount: { type: Number, required: true },
    provider: { type: String, enum: ['paymongo', 'stripe', 'gcash', 'manual'], required: true },
    sessionId: { type: String },
    paymentId: { type: String },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
