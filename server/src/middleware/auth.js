const { verifyToken, requireSession } = require('../../lib/accountLifecycle');
const prisma = require('../../lib/prisma');
const { isUuid } = require('../../lib/ids');

// Staff record minus the password hash (was .select('-password')).
const ADMIN_FIELDS = {
  id: true, legacyId: true, fullName: true, purok: true, email: true,
  role: true, active: true, sessionVersion: true, oauthProvider: true, oauthId: true, createdAt: true, updatedAt: true,
};

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token, 'staff');
    // Ids are UUIDs now; a malformed one would make Prisma throw.
    if (!isUuid(decoded.id)) return res.status(401).json({ message: 'User not found' });

    req.user = await prisma.admin.findUnique({
      where: { id: decoded.id },
      select: ADMIN_FIELDS,
    });
    if (!requireSession(req.user, decoded, res)) return;
    next();
  } catch {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied: insufficient role' });
  }
  next();
};

module.exports = { protect, requireRole };
