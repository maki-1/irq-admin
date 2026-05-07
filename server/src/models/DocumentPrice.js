const mongoose = require('mongoose');

const documentPriceSchema = new mongoose.Schema(
  {
    documentType:  { type: String, required: true, unique: true, trim: true },
    pricecentavos: { type: Number, required: true, min: 0 },
    description:   { type: String, default: '' },
    updatedBy:     { type: String, default: '' },
  },
  { strict: false, timestamps: true, collection: 'documentprices' }
);

module.exports = mongoose.model('DocumentPrice', documentPriceSchema);
