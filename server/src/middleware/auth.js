const jwt = require('jsonwebtoken');
const prisma = require('../../lib/prisma');
const { isUuid } = require('../../lib/ids');

// Staff record minus the password hash (was .select('-password')).
const ADMIN_FIELDS = {
  id: true, legacyId: true, fullName: true, purok: true, email: true,
  role: true, active: true, oauthProvider: true, oauthId: true, createdAt: true, updatedAt: true,
};

// Without JWT_SECRET the bearer token is taken as a raw user id and not
// verified at all. That is a development convenience only — in production it
// would let anyone authenticate as any user, so it is refused there.
function decodeToken(token) {
  if (process.env.JWT_SECRET) return jwt.verify(token, process.env.JWT_SECRET);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not configured');
  }
  return { id: token };
}

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = decodeToken(token);
    // Ids are UUIDs now; a malformed one would make Prisma throw.
    if (!isUuid(decoded.id)) return res.status(401).json({ message: 'User not found' });

    req.user = await prisma.admin.findUnique({
      where: { id: decoded.id },
      select: ADMIN_FIELDS,
    });
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    // A staff member deactivated mid-session is locked out on their next request.
    if (req.user.active === false) {
      return res.status(403).json({ message: 'This account has been deactivated.' });
    }
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
