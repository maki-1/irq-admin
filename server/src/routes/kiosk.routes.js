const router = require('express').Router();
const ctrl = require('../controllers/kiosk.controller');
const kioskGuard = require('../middleware/kioskGuard');

// No login here: the printed purok-clearance control number is the credential.
// kioskGuard supplies the device key check and a guessing rate limit.
router.use(kioskGuard);

router.post('/clearance/verify', ctrl.verifyClearance);
router.post('/requests', ctrl.submitRequests);

module.exports = router;
