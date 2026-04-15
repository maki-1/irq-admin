const Document = require('../models/Document');
const auditLog = require('../utils/auditLog');
const sendEmail = require('../utils/sendEmail');

// POST /api/documents  – secretary creates a document request on behalf of a resident
exports.createDocument = async (req, res) => {
  try {
    const doc = await Document.create({ ...req.body, createdBy: req.user._id });
    await auditLog({ user: req.user, action: 'Created Document Request', details: `Type: ${doc.documentType}, Name: ${doc.fullName}` });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/documents  – all staff see all documents
exports.getDocuments = async (req, res) => {
  try {
    const docs = await Document.find()
      .populate('createdBy', 'fullName role')
      .sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/documents/:id
exports.getDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).populate('createdBy', 'fullName role');
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/documents/:id/status  – secretary updates workflow status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const doc = await Document.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    await auditLog({ user: req.user, action: 'Update Status', details: `Request ID: ${doc.customId}, New Status: ${status}` });

    // Notify resident via email when completed
    if (status === 'Completed' && doc.email) {
      await sendEmail({
        to: doc.email,
        subject: 'Your document is ready – iRequestDologon',
        html: `<p>Dear <strong>${doc.fullName}</strong>,</p>
               <p>Your <strong>${doc.documentType}</strong> (${doc.customId}) is ready for pick-up at the Barangay Office of Dologon.</p>`,
      });
    }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/documents/:id/sign  – barangay captain signs
exports.signDocument = async (req, res) => {
  try {
    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      { signatureStatus: 'Signed' },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    await auditLog({ user: req.user, action: 'Signed Document', details: `Request ID: ${doc.customId}, New Value: Signed` });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/documents/:id/seal  – barangay captain seals
exports.sealDocument = async (req, res) => {
  try {
    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      { sealStatus: 'Sealed' },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    await auditLog({ user: req.user, action: 'Sealed Document', details: `Request ID: ${doc.customId}, New Value: Sealed` });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/documents/:id/receipt  – upload payment receipt → Cloudinary
exports.uploadReceipt = async (req, res) => {
  try {
    if (!req.cloudinary) return res.status(400).json({ message: 'No file uploaded' });
    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      { receiptFile: req.cloudinary.secure_url, paymentStatus: 'Pending Verification' },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    await auditLog({ user: req.user, action: 'Uploaded Receipt', details: `Request ID: ${doc.customId}` });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/documents/:id/photo  – upload resident photo → Cloudinary
exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.cloudinary) return res.status(400).json({ message: 'No file uploaded' });
    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      { residentPhoto: req.cloudinary.secure_url },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/documents/:id/payment  – collector verifies / rejects payment
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { paymentStatus, orNumber } = req.body;
    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      { paymentStatus, ...(orNumber && { orNumber }) },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    await auditLog({ user: req.user, action: 'Update Payment', details: `Request ID: ${doc.customId}, Status: ${paymentStatus}` });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
