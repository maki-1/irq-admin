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
    orNumber:                  { type: String },
    freeDocumentProof:         { type: String },
    controlNumber:  { type: String },
    requestPhoto:   { type: String },
    // Purok Leader approval
    claimCode:          { type: String, default: null },
    // Purok Leader approval
    purokLeaderStatus:  { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    purokLeaderBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    purokLeaderAt:      { type: Date, default: null },
    purokLeaderRemarks: { type: String, default: '' },
    purokClearanceFee:  { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'requests' }
);

module.exports = mongoose.model('Request', requestSchema, 'requests');
