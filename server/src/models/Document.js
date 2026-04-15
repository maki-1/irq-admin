const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    customId: { type: String, unique: true, sparse: true }, // e.g. DL-0001
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // staff who entered the request

    // Personal info (snapshot at time of request)
    fullName: { type: String, required: true },
    age: { type: Number },
    gender: { type: String },
    dateOfBirth: { type: Date },
    maritalStatus: { type: String },
    purok: { type: String },
    contactNumber: { type: String },
    email: { type: String },
    residentType: {
      type: String,
      enum: ['Regular', 'PWD', 'Senior Citizen', 'IP'],
      default: 'Regular',
    },
    ipMember: { type: Boolean, default: false },
    ethnicGroup: { type: String },
    registeredVoter: { type: Boolean, default: false },

    // Document details
    documentType: {
      type: String,
      enum: ['Barangay Clearance', 'Certificate of Residency', 'Certificate of Indigency'],
      required: true,
    },
    requestDate: { type: Date, default: Date.now },
    purpose: { type: String },

    // Workflow
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Printing', 'Completed', 'Rejected'],
      default: 'Pending',
    },

    // Payment
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Pending Verification', 'Paid', 'Exempt'],
      default: 'Pending',
    },
    documentFee: { type: Number, default: 130 },
    receiptFile: { type: String },
    orNumber: { type: String },

    // Signing / sealing
    signatureStatus: { type: String, default: '' },
    sealStatus: { type: String, default: '' },

    // Resident photo used in this request
    residentPhoto: { type: String },
  },
  { timestamps: true }
);

// Auto-generate customId (DL-XXXX) before save
documentSchema.pre('save', async function (next) {
  if (this.customId) return next();
  const count = await mongoose.model('Document').countDocuments();
  this.customId = `DL-${String(count + 1).padStart(4, '0')}`;
  next();
});

module.exports = mongoose.model('Document', documentSchema);
