const mongoose = require('mongoose');

const verificationProfileSchema = new mongoose.Schema(
  {
    // Personal info submitted by the resident/client
    fullName:      { type: String, required: true, trim: true },
    purok:         { type: String, required: true, trim: true },
    email:         { type: String, trim: true, lowercase: true },
    contactNumber: { type: String, trim: true },
    dateOfBirth:   { type: Date },
    gender:        { type: String, enum: ['Male', 'Female', 'Other'] },
    civilStatus:   { type: String, enum: ['Single', 'Married', 'Widowed', 'Separated'] },
    nationality:   { type: String, default: 'Filipino' },
    occupation:    { type: String },

    // Uploaded IDs / proof documents (URLs — Cloudinary or local paths)
    governmentId:  { type: String },   // front photo of valid ID (legacy)
    selfieWithId:  { type: String },   // selfie holding the ID (legacy)
    proofOfResidency: { type: String },// utility bill, lease, etc.

    // ID details
    idType:  { type: String },         // e.g. "Passport", "Driver's License"
    idName:  { type: String },         // name printed on the ID
    idFront: { type: String },         // URL — front of the ID card
    idBack:  { type: String },         // URL — back of the ID card

    // Additional photos / docs
    facePhoto:             { type: String }, // clear face photo
    educationCertificate:  { type: String }, // diploma, TOR, etc.

    // Workflow — values must match what verification.controller.js writes
    status: {
      type: String,
      enum: ['Pending', 'pending', 'submitted', 'under review', 'approved', 'rejected'],
      default: 'Pending',
    },

    // Secretary remarks when rejecting or approving
    remarks: { type: String, default: '' },

    // Which staff member reviewed it
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { strict: false, timestamps: true, collection: 'verificationprofiles' }
);

module.exports = mongoose.model('VerificationProfile', verificationProfileSchema);
