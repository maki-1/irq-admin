const router = require('express').Router();
const ctrl = require('../controllers/document.controller');
const { protect, requireRole } = require('../middleware/auth');
const { uploadToCloudinary } = require('../middleware/upload');

router.use(protect);

router.post('/', ctrl.createDocument);
router.get('/', ctrl.getDocuments);
router.get('/:id', ctrl.getDocument);

router.patch('/:id/status',  requireRole('Secretary', 'Barangay Captain'), ctrl.updateStatus);
router.patch('/:id/sign',    requireRole('Barangay Captain'), ctrl.signDocument);
router.patch('/:id/seal',    requireRole('Barangay Captain'), ctrl.sealDocument);
router.patch('/:id/payment', requireRole('Collector', 'Secretary'), ctrl.updatePaymentStatus);

// File uploads → stream directly to Cloudinary
router.post(
  '/:id/receipt',
  uploadToCloudinary('receipt', 'irequestdologon/receipts'),
  ctrl.uploadReceipt
);
router.post(
  '/:id/photo',
  uploadToCloudinary('photo', 'irequestdologon/photos', 'image'),
  ctrl.uploadPhoto
);

module.exports = router;
