const mongoose = require('mongoose');

const verificationProfileSchema = new mongoose.Schema(
  {
    // Link to the resident who submitted this profile
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'ResidentUser', required: true, unique: true, index: true },

    // Personal info submitted by the resident/client
    fullName:      { type: String, trim: true },
    email:         { type: String, trim: true, lowercase: true },
    contactNumber: { type: String, trim: true },
    birthday:      { type: Date },
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
    facePhoto:             { type: String },
    educationCertificate:  { type: String },

    // Extended personal info saved by Step1
    age:             { type: Number },
    yearsAtAddress:  { type: Number },
    address:         { type: String },
    motherName:      { type: String },
    fatherName:      { type: String },
    isPwd:           { type: Boolean, default: false },
    isSenior:        { type: Boolean, default: false },
    isIndigent:      { type: Boolean, default: false },
    pwdProof:        { type: String },
    indigentProof:   { type: String },

    // Education info saved by Step2
    educationLevel:  { type: String },
    school:          { type: String },
    yearGraduated:   { type: Number },
    course:          { type: String },

    // Secondary ID saved by Step3
    secondaryIdType:  { type: String },
    secondaryIdName:  { type: String },
    secondaryIdFront: { type: String },
    secondaryId2Type:  { type: String },
    secondaryId2Name:  { type: String },
    secondaryId2Front: { type: String },

    // Workflow — values must match what verification.controller.js writes
    status: {
      type: String,
      enum: ['Pending', 'pending', 'submitted', 'under review', 'approved', 'rejected'],
      default: 'Pending',
    },

    // Secretary remarks when rejecting or approving
    remarks: { type: String, default: '' },

    // AI verification results set automatically during Step 3 upload
    aiVerification: {
      // Groq / Llama-4 vision — document validity + face match assessment
      faceMatch:  { type: String },  // YES | NO | UNCERTAIN
      idValid:    { type: String },  // YES | NO | UNCERTAIN
      confidence: { type: String },  // HIGH | MEDIUM | LOW
      notes:      { type: String },
      // Azure Face API — dedicated face comparison
      azureIsIdentical: { type: Boolean },
      azureConfidence:  { type: Number },  // 0.0 – 1.0
      azureError:       { type: String },
      checkedAt:        { type: Date },
    },

    // Which staff member reviewed it
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { strict: false, timestamps: true, collection: 'verificationprofiles' }
);

module.exports = mongoose.model('VerificationProfile', verificationProfileSchema);
