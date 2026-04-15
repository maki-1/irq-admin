const router = require('express').Router();
const { createPayMongoSession, payMongoWebhook } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth');

router.post('/paymongo/checkout', protect, createPayMongoSession);
router.post('/paymongo/webhook', payMongoWebhook); // no auth – called by PayMongo

module.exports = router;
