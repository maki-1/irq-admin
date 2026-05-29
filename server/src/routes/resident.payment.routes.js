const router = require('express').Router();
const ctrl   = require('../controllers/resident.payment.controller');
const { residentProtect } = require('../middleware/residentAuth');
const { multiUpload }     = require('../middleware/upload');

const photoFields = Array.from({ length: 10 }, (_, i) => ({
  name: `documents[${i}][photo]`, maxCount: 1,
}));

router.post('/create-session',          residentProtect, multiUpload(photoFields), ctrl.createSession);
router.post('/pay-approved/:id',        residentProtect, ctrl.payApproved);
router.get('/verify/:requestId',        residentProtect, ctrl.verifyPayment);

module.exports = router;
