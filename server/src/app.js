require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

// Route imports
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const documentRoutes = require('./routes/document.routes');
const paymentRoutes = require('./routes/payment.routes');
const notificationRoutes = require('./routes/notification.routes');
const auditRoutes = require('./routes/audit.routes');
const verificationRoutes = require('./routes/verification.routes');
const requestRoutes      = require('./routes/request.routes');
const releaseRoutes           = require('./routes/release.routes');
const documentPriceRoutes     = require('./routes/documentPrice.routes');
const cropRoutes              = require('./routes/crop.routes');
const purokLeaderRoutes       = require('./routes/purokLeader.routes');
const purokClearanceFeeRoutes = require('./routes/purokClearanceFee.routes');

// Resident (public portal) routes
const residentVerificationRoutes = require('./routes/resident.verification.routes');
const residentRequestRoutes      = require('./routes/resident.request.routes');
const residentPaymentRoutes      = require('./routes/resident.payment.routes');
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes — Admin
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/verifications', verificationRoutes);
app.use('/api/requests',     requestRoutes);
app.use('/api/releases',        releaseRoutes);
app.use('/api/document-prices', documentPriceRoutes);
app.use('/api/crop-id',        cropRoutes);
app.use('/api/purok-leader',   purokLeaderRoutes);
// Public SMS one-tap approval (authorised by a signed link, not a session).
app.use('/api/purok-approve',  require('./routes/purokApprove.routes'));
app.use('/api/purok-clearance', purokClearanceFeeRoutes);
// Issuance register — mounted after the fee routes so their fixed paths
// ('/all-fees') keep precedence over this router's own.
app.use('/api/purok-clearance', require('./routes/purokClearance.routes'));

// API Routes — Resident (public portal)
app.use('/api/verification', residentVerificationRoutes); // step1/2/3/status
app.use('/api/my/requests',  residentRequestRoutes);      // resident-only requests (avoids conflict with admin /api/requests)
app.use('/api/payment',      residentPaymentRoutes);      // create-session

// Prices alias for public portal
app.get('/api/admin/prices', async (req, res) => {
  try {
    const prisma = require('../lib/prisma');
    const prices = await prisma.documentPrice.findMany({ orderBy: { documentType: 'asc' } });
    const map = {};
    prices.forEach((p) => { map[p.documentType] = p.pricecentavos / 100; });
    res.json(map);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve client SPA in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

// 404 handler (API routes only)
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
