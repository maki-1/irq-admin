const mongoose = require('mongoose');

const completedDocumentSchema = new mongoose.Schema(
  {
    request:      { type: mongoose.Schema.Types.ObjectId, ref: 'Request', unique: true },
    user:         { type: mongoose.Schema.Types.ObjectId, ref: 'ResidentUser' },
    documentType: { type: String },
    purpose:      { type: String },
    claimCode:    { type: String, unique: true },
    // snapshot of profile at completion time
    fullName:     { type: String },
    age:          { type: Number },
    purok:        { type: String },
    address:      { type: String },
    claimStatus:  { type: String, enum: ['pending', 'claimed'], default: 'pending' },
    completedAt:  { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'completed_documents' }
);

module.exports = mongoose.model('CompletedDocument', completedDocumentSchema, 'completed_documents');
