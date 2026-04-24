const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema(
  {
    user:              { type: mongoose.Schema.Types.ObjectId, ref: 'ResidentUser' },
    documentType:      { type: String },
    purpose:           { type: String },
    additionalDetails: { type: String },
    deliveryMethod:    { type: String },
    yearsAtAddress:    { type: Number },
    status:            { type: String, default: 'Pending' },
    paymentStatus:     { type: String, default: 'unpaid' },
    paymentLinkId:     { type: String },
    amountPaid:        { type: Number },
  },
  { timestamps: true, collection: 'requests' }
);

module.exports = mongoose.model('Request', requestSchema, 'requests');
