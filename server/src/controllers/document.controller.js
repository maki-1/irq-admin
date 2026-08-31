const prisma = require('../../lib/prisma');
const { toApi } = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');
const auditLog = require('../utils/auditLog');
const sendEmail = require('../utils/sendEmail');

const CREATED_BY = { select: { id: true, fullName: true, role: true } };

// Mongoose spread `...req.body` straight into the model, which silently ignored
// unknown keys. Prisma rejects them, so the accepted fields are listed here.
const WRITABLE = [
  'fullName', 'age', 'gender', 'dateOfBirth', 'maritalStatus', 'purok',
  'contactNumber', 'email', 'residentType', 'ipMember', 'ethnicGroup',
  'registeredVoter', 'documentType', 'requestDate', 'purpose', 'status',
  'paymentStatus', 'documentFee', 'receiptFile', 'orNumber',
  'signatureStatus', 'sealStatus', 'residentPhoto',
];

function pickWritable(body) {
  const out = {};
  for (const k of WRITABLE) {
    if (body[k] === undefined) continue;
    if (k === 'age') out[k] = body[k] === null ? null : parseInt(body[k], 10);
    else if (k === 'dateOfBirth' || k === 'requestDate') out[k] = new Date(body[k]);
    else if (k === 'ipMember' || k === 'registeredVoter') out[k] = Boolean(body[k]);
    else out[k] = body[k];
  }
  return out;
}

// Replaces the pre('save') hook, which derived customId from a document count —
// two concurrent creates would have produced the same DL number. This uses the
// same atomic counter table as OR numbers.
async function nextCustomId() {
  const counter = await prisma.counter.upsert({
    where: { id: 'documentCustomId' },
    create: { id: 'documentCustomId', seq: 1 },
    update: { seq: { increment: 1 } },
  });
  return `DL-${String(counter.seq).padStart(4, '0')}`;
}

// Mongo's findByIdAndUpdate returned null when nothing matched; Prisma throws.
async function updateDoc(id, data) {
  if (!isUuid(id)) return null;
  return prisma.document.update({ where: { id }, data }).catch((e) => {
    if (e.code === 'P2025') return null;
    throw e;
  });
}

// POST /api/documents  – secretary creates a document request on behalf of a resident
exports.createDocument = async (req, res) => {
  try {
    const doc = await prisma.document.create({
      data: {
        ...pickWritable(req.body),
        customId: req.body.customId || (await nextCustomId()),
        createdById: req.user.id,
      },
    });
    await auditLog({ user: req.user, action: 'Created Document Request', details: `Type: ${doc.documentType}, Name: ${doc.fullName}` });
    res.status(201).json(toApi(doc));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/documents  – all staff see all documents
exports.getDocuments = async (req, res) => {
  try {
    const docs = await prisma.document.findMany({
      include: { createdBy: CREATED_BY },
      orderBy: { createdAt: 'desc' },
    });
    res.json(toApi(docs));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/documents/:id
exports.getDocument = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Document not found' });
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { createdBy: CREATED_BY },
    });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json(toApi(doc));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/documents/:id/status  – secretary updates workflow status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const doc = await updateDoc(req.params.id, { status });
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
    res.json(toApi(doc));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/documents/:id/sign  – barangay captain signs
exports.signDocument = async (req, res) => {
  try {
    const doc = await updateDoc(req.params.id, { signatureStatus: 'Signed' });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    await auditLog({ user: req.user, action: 'Signed Document', details: `Request ID: ${doc.customId}, New Value: Signed` });
    res.json(toApi(doc));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/documents/:id/seal  – barangay captain seals
exports.sealDocument = async (req, res) => {
  try {
    const doc = await updateDoc(req.params.id, { sealStatus: 'Sealed' });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    await auditLog({ user: req.user, action: 'Sealed Document', details: `Request ID: ${doc.customId}, New Value: Sealed` });
    res.json(toApi(doc));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/documents/:id/receipt  – upload payment receipt → Cloudinary
exports.uploadReceipt = async (req, res) => {
  try {
    if (!req.cloudinary) return res.status(400).json({ message: 'No file uploaded' });
    const doc = await updateDoc(req.params.id, {
      receiptFile: req.cloudinary.secure_url,
      paymentStatus: 'Pending Verification',
    });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    await auditLog({ user: req.user, action: 'Uploaded Receipt', details: `Request ID: ${doc.customId}` });
    res.json(toApi(doc));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/documents/:id/photo  – upload resident photo → Cloudinary
exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.cloudinary) return res.status(400).json({ message: 'No file uploaded' });
    const doc = await updateDoc(req.params.id, { residentPhoto: req.cloudinary.secure_url });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json(toApi(doc));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/documents/:id/payment  – collector verifies / rejects payment
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { paymentStatus, orNumber } = req.body;
    const doc = await updateDoc(req.params.id, {
      paymentStatus,
      ...(orNumber && { orNumber }),
    });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    await auditLog({ user: req.user, action: 'Update Payment', details: `Request ID: ${doc.customId}, Status: ${paymentStatus}` });
    res.json(toApi(doc));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
