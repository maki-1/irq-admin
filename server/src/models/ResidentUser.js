const mongoose = require('mongoose');

// Read-only model for the mobile app's 'users' collection (residents)
const residentUserSchema = new mongoose.Schema(
  {},
  { strict: false, timestamps: true, collection: 'users' }
);

module.exports = mongoose.model('ResidentUser', residentUserSchema, 'users');
