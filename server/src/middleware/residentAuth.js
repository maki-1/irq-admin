const { verifyToken, requireSession } = require('../../lib/accountLifecycle');
const prisma = require('../../lib/prisma');
const { isUuid } = require('../../lib/ids');

const residentProtect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token, 'resident');
    if (!isUuid(decoded.id)) return res.status(401).json({ message: 'User not found' });

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!requireSession(user, decoded, res)) return;

    // Contact verification is separate from staff review of resident documents.
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
