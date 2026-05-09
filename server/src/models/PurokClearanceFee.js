const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    purokName:      { type: String, required: true, trim: true },
    feecentavos:    { type: Number, required: true },
    description:    { type: String, default: '' },
    updatedBy:      { type: String, default: '' },
    purokPresident: { type: String, default: '' },
    treasurerName:  { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PurokClearanceFee', schema, 'purok_clearance_fee');
