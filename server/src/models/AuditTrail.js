const mongoose = require('mongoose');

const auditTrailSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String },
    role: { type: String },
    action: { type: String, required: true },
    details: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditTrail', auditTrailSchema);
