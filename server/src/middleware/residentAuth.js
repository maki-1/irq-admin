const jwt = require('jsonwebtoken');
const prisma = require('../../lib/prisma');
const { isUuid } = require('../../lib/ids');

// Residents live in the `users` table, shared with the Flutter backend.
// Same caveat as middleware/auth.js: the unverified fallback is a development
// convenience and is refused in production.
function decodeToken(token) {
  if (process.env.JWT_SECRET) return jwt.verify(token, process.env.JWT_SECRET);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not configured');
  }
  return { id: token, role: 'resident' };
}

const residentProtect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = decodeToken(token);
    if (process.env.JWT_SECRET && decoded.role !== 'resident') {
      return res.status(403).json({ message: 'Resident access only' });
    }
    if (!isUuid(decoded.id)) return res.status(401).json({ message: 'User not found' });

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json({ message: 'User not found' });

    // Belt and braces behind the login gate. Tokens live seven days, so the
    // ones handed out before login checked this are still presentable, and the
    // dev fallback above will mint one from any bare user id. An account that
    // never entered its registration OTP gets nothing either way.
    if (!user.contactVerified) {
      return res.status(403).json({
        message: 'Your account is not verified yet. Enter the code we sent you to finish signing up.',
        requiresOtpVerification: true,
        userId: user.id,
      });
    }

    req.resident = user;
    next();
  } catch {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
};

module.exports = { residentProtect };
