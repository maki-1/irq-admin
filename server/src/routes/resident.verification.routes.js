const router = require('express').Router();
const ctrl   = require('../controllers/resident.verification.controller');
const { residentProtect } = require('../middleware/residentAuth');
const { multiUpload }     = require('../middleware/upload');

const step1Fields = multiUpload([
  { name: 'pwdProof',     maxCount: 1 },
  { name: 'indigentProof', maxCount: 1 },
]);

const step2Fields = multiUpload([
  { name: 'educationCert', maxCount: 1 },
]);

const step3Fields = multiUpload([
  { name: 'idFront',           maxCount: 1 },
  { name: 'idBack',            maxCount: 1 },
  { name: 'facePhoto',         maxCount: 1 },
  { name: 'secondaryIdFront',  maxCount: 1 },
  { name: 'secondaryId2Front', maxCount: 1 },
]);

router.post('/step1',  residentProtect, step1Fields, ctrl.step1);
router.post('/step2',  residentProtect, step2Fields, ctrl.step2);
router.post('/step3',  residentProtect, step3Fields, ctrl.step3);
router.get('/status',  residentProtect, ctrl.getStatus);
// Populates the purok picker in step 1 — the same list the Android app uses.
router.get('/puroks',  residentProtect, ctrl.getPuroks);

module.exports = router;
