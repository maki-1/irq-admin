const router = require('express').Router();
const ctrl   = require('../controllers/resident.verification.controller');
const identity = require('../controllers/didit.verification.controller');
const { residentProtect } = require('../middleware/residentAuth');
const { multiUpload }     = require('../middleware/upload');

const step1Fields = multiUpload([
  { name: 'pwdProof',     maxCount: 1 },
  { name: 'indigentProof', maxCount: 1 },
]);

const step2Fields = multiUpload([
  { name: 'educationCert', maxCount: 1 },
]);

router.post('/step1',  residentProtect, step1Fields, ctrl.step1);
router.post('/step2',  residentProtect, step2Fields, ctrl.step2);
router.post('/identity/session', residentProtect, identity.start);
router.post('/identity/complete', residentProtect, identity.complete);
router.post('/liveness/session', residentProtect, identity.legacy);
router.post('/liveness/complete', residentProtect, identity.legacy);
router.post('/step3', residentProtect, identity.submit);
router.get('/status',  residentProtect, ctrl.getStatus);
// Populates the purok picker in step 1 — the same list the Android app uses.
router.get('/puroks',  residentProtect, ctrl.getPuroks);

module.exports = router;
