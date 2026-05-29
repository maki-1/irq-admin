// Mounted at /api/my/requests — resident-only, no conflict with admin /api/requests
const router = require('express').Router();
const ctrl   = require('../controllers/resident.request.controller');
const { residentProtect } = require('../middleware/residentAuth');
const { multiUpload }     = require('../middleware/upload');

const bulkPhotoFields = Array.from({ length: 10 }, (_, i) => ({
  name: `documents[${i}][photo]`, maxCount: 1,
}));

router.get('/summary',   residentProtect, ctrl.getSummary);
router.get('/completed', residentProtect, ctrl.getMyCompleted);
router.get('/claimed',   residentProtect, ctrl.getClaimed);
router.post('/bulk',     residentProtect, multiUpload(bulkPhotoFields), ctrl.createBulk);
router.get('/',          residentProtect, ctrl.getMyRequests);
router.delete('/:id',    residentProtect, ctrl.deleteRequest);

module.exports = router;
